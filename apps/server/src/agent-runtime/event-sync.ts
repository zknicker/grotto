import type { AgentRuntimeEvent } from '@tavern/api';
import {
    confirmAgentRuntimeConnection,
    loadAgentRuntimeConnection,
    markAgentRuntimeConnectionFailure,
    markAgentRuntimeConnectionReachable,
    refreshRuntimeOwnedStatus,
} from '../agent-runtime-connection/service.ts';
import {
    emitAgentInstructionsUpdated,
    emitAgentRuntimeCapabilityUpdated,
    emitAgentRuntimeUpdated,
    emitAgentUpdated,
    emitChatLogUpdated,
    emitChatUpdated,
    emitEngineRestartUpdated,
    emitModelUpdated,
    emitPaneUpdated,
    emitRemindersUpdated,
    emitSessionUpdated,
    emitTasksUpdated,
    emitWorkersUpdated,
} from '../api/invalidation-events.ts';
import { enqueueRuntimeSkillInventoryRefresh } from '../skills/inventory-job.ts';
import { listReachableAgentRuntimeConnections } from '../storage/agent-runtime-connections.ts';
import { syncAgentRuntimeAgents } from '../sync/agent-runtime-sync.ts';
import {
    createAgentRuntimeClientForConnection,
    createTavernClientForConnection,
    subscribeAgentRuntimeEventsForConnection,
} from './drivers.ts';
import { emitObservedAgentRuntimeEvent } from './events.ts';

type RuntimeConnectionRecord = Awaited<
    ReturnType<typeof listReachableAgentRuntimeConnections>
>[number];

let started = false;
let activeEventConnections = new Map<string, { close(): void }>();
let reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
let connectionRevision = 0;
const eventStreamReconnectDelayMs = 1000;
const threadParentChatIds = new Map<string, string>();

export async function applyObservedAgentRuntimeEvent(
    event: AgentRuntimeEvent,
    connection?: RuntimeConnectionRecord
) {
    switch (event.type) {
        case 'agent.updated': {
            emitObservedAgentRuntimeEvent(event);
            void syncAgentRuntimeAgents().catch((error) => {
                console.warn('[tavern] failed to sync agent event', error);
            });
            emitAgentUpdated();
            return;
        }
        case 'chat.historyChanged': {
            emitObservedAgentRuntimeEvent(event);
            const parentChatId = await resolveThreadParentChatId(event.chatId, connection);
            emitChatUpdated({ chatId: parentChatId ?? event.chatId });
            emitChatLogUpdated();
            if (parentChatId) {
                emitChatLogUpdated({ chatId: parentChatId });
            }
            // Chat activity is the honest refresh signal for agent-side task and reminder actions.
            emitTasksUpdated();
            emitRemindersUpdated();
            return;
        }
        case 'chat.messageAccepted': {
            emitObservedAgentRuntimeEvent(event);
            const parentChatId = await resolveThreadParentChatId(event.chatId, connection);
            if (parentChatId) {
                emitChatUpdated({ chatId: parentChatId });
                emitChatLogUpdated({ chatId: event.chatId });
                emitChatLogUpdated({ chatId: parentChatId });
            } else {
                emitChatUpdated();
                emitChatLogUpdated();
            }
            // Chat activity is the honest refresh signal for agent-side task and reminder actions.
            emitTasksUpdated();
            emitRemindersUpdated();
            return;
        }
        case 'chat.read': {
            emitObservedAgentRuntimeEvent(event);
            const parentChatId = await resolveThreadParentChatId(event.chatId, connection);
            if (parentChatId) {
                emitChatUpdated({ chatId: parentChatId });
                emitChatLogUpdated({ chatId: parentChatId });
            } else {
                emitChatUpdated();
            }
            return;
        }
        case 'model.updated': {
            emitObservedAgentRuntimeEvent(event);
            emitModelUpdated();
            return;
        }
        case 'workspace.instructions.updated': {
            emitObservedAgentRuntimeEvent(event);
            emitAgentInstructionsUpdated({ agentId: event.agentId });
            return;
        }
        case 'skill.updated': {
            emitObservedAgentRuntimeEvent(event);
            queueRuntimeSkillInventoryRefresh();
            return;
        }
        case 'skill.deleted': {
            emitObservedAgentRuntimeEvent(event);
            queueRuntimeSkillInventoryRefresh();
            return;
        }
        case 'pane.updated': {
            emitObservedAgentRuntimeEvent(event);
            emitPaneUpdated({ chatId: event.chatId, revision: event.revision });
            return;
        }
        case 'engine.restart': {
            emitObservedAgentRuntimeEvent(event);
            emitEngineRestartUpdated({ phase: event.phase });
            return;
        }
        case 'runtime.update': {
            emitObservedAgentRuntimeEvent(event);
            emitAgentRuntimeUpdated();
            return;
        }
        case 'reminder.updated': {
            emitObservedAgentRuntimeEvent(event);
            emitRemindersUpdated();
            return;
        }
        case 'agent.composition': {
            // Volatile relay only (I1): no invalidation, no persistence — the
            // subscription fans the event to clients and nothing else reacts.
            emitObservedAgentRuntimeEvent(event);
            return;
        }
        case 'capability.updated': {
            emitObservedAgentRuntimeEvent(event);
            if (!connection) {
                emitAgentRuntimeCapabilityUpdated();
                emitAgentRuntimeUpdated();
                return;
            }

            await refreshRuntimeCapability(connection).catch((error) => {
                console.warn('[tavern] failed to refresh runtime capability', error);
            });
            return;
        }
        case 'session.invalidated':
        case 'session.updated': {
            const sessionKey =
                event.type === 'session.updated' ? event.session.key : event.sessionKey;
            emitObservedAgentRuntimeEvent(event);
            emitWorkersUpdated();
            emitSessionUpdated({ sessionKey });
            emitChatLogUpdated({ sessionKey });
            return;
        }
    }
}

async function resolveThreadParentChatId(chatId: string, connection?: RuntimeConnectionRecord) {
    if (!chatId.startsWith('cht_thr_')) {
        return null;
    }

    if (!connection) {
        return null;
    }
    const cacheKey = `${connection.id}:${chatId}`;
    const cached = threadParentChatIds.get(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const chat = await createTavernClientForConnection(connection).chat.get(chatId);
        if (chat.kind !== 'thread' || !chat.parent_chat_id) {
            return null;
        }
        threadParentChatIds.set(cacheKey, chat.parent_chat_id);
        return chat.parent_chat_id;
    } catch (error) {
        console.warn('[tavern] failed to resolve thread parent for invalidation', error);
        return null;
    }
}

function queueRuntimeSkillInventoryRefresh() {
    void enqueueRuntimeSkillInventoryRefresh().catch((error) => {
        console.warn('[tavern] failed to queue skills inventory refresh', error);
    });
}

async function refreshRuntimeCapability(connection: RuntimeConnectionRecord) {
    await refreshRuntimeOwnedStatus(connection);
    emitAgentRuntimeCapabilityUpdated();
    emitAgentRuntimeUpdated();
}

function disconnectActiveSockets() {
    for (const connection of activeEventConnections.values()) {
        connection.close();
    }

    activeEventConnections = new Map();
    for (const timer of reconnectTimers.values()) {
        clearTimeout(timer);
    }
    reconnectTimers = new Map();
}

async function markConnectionUnavailable(connection: RuntimeConnectionRecord, error: unknown) {
    await markAgentRuntimeConnectionFailure({
        connectionId: connection.id,
        error,
    });
    emitAgentRuntimeUpdated();
}

async function markConnectionReachable(connection: RuntimeConnectionRecord) {
    await markAgentRuntimeConnectionReachable({ connectionId: connection.id });
    emitAgentRuntimeUpdated();
}

function scheduleRuntimeEventReconnect(connection: RuntimeConnectionRecord, revision: number) {
    if (revision !== connectionRevision || reconnectTimers.has(connection.id)) {
        return;
    }

    const timer = setTimeout(() => {
        reconnectTimers.delete(connection.id);
        if (revision === connectionRevision) {
            connectRuntimeEvents(connection, revision);
        }
    }, eventStreamReconnectDelayMs);

    reconnectTimers.set(connection.id, timer);
}

function connectRuntimeEvents(connection: RuntimeConnectionRecord, revision: number) {
    void subscribeAgentRuntimeEventsForConnection(connection, {
        onClose: () => {
            if (revision !== connectionRevision) {
                return;
            }

            activeEventConnections.delete(connection.id);
            void markConnectionUnavailable(connection, new Error('Runtime event stream closed.'));
            scheduleRuntimeEventReconnect(connection, revision);
        },
        onEvent: (event) => {
            if (revision !== connectionRevision) {
                return;
            }

            void applyObservedAgentRuntimeEvent(event, connection).catch((error) => {
                console.warn('[tavern] failed to apply observed runtime event', error);
            });
        },
    })
        .then((subscription) => {
            if (revision !== connectionRevision) {
                subscription.close();
                return;
            }

            activeEventConnections.set(connection.id, subscription);
            void catchUpRuntimeEvents(connection, revision);
            void markConnectionReachable(connection).catch((error) => {
                console.warn('[tavern] failed to mark runtime reachable', error);
            });
            void confirmAgentRuntimeConnection().catch((error) => {
                console.warn('[tavern] failed to refresh runtime capabilities', error);
            });
        })
        .catch((error) => {
            if (revision !== connectionRevision) {
                return;
            }

            void markConnectionUnavailable(connection, error);
            scheduleRuntimeEventReconnect(connection, revision);
        });
}

async function catchUpRuntimeEvents(connection: RuntimeConnectionRecord, revision: number) {
    try {
        const client = createAgentRuntimeClientForConnection(connection);
        const { events } = await client.listEvents({ limit: 500 });
        client.close();

        if (revision !== connectionRevision) {
            return;
        }

        for (const event of events) {
            await applyObservedAgentRuntimeEvent(event, connection);
        }
        emitRuntimeReconnectInvalidations();
    } catch (error) {
        if (revision === connectionRevision) {
            console.warn('[tavern] failed to catch up runtime events', error);
        }
    }
}

function emitRuntimeReconnectInvalidations() {
    emitChatUpdated();
    emitChatLogUpdated();
    emitSessionUpdated();
    emitWorkersUpdated();
}

export function refreshAgentRuntimeEventSync() {
    if (!started) {
        return;
    }

    connectionRevision += 1;
    disconnectActiveSockets();

    const revision = connectionRevision;

    void listReachableAgentRuntimeConnections()
        .then(async (connections) => {
            if (connections.length > 0 || revision !== connectionRevision) {
                return connections;
            }

            await loadAgentRuntimeConnection();
            return await listReachableAgentRuntimeConnections();
        })
        .then((connections) => {
            if (revision !== connectionRevision) {
                return;
            }

            for (const connection of connections) {
                connectRuntimeEvents(connection, revision);
            }
        })
        .catch((error) => {
            console.warn('[tavern] failed to load runtime event connections', error);
        });
}

export function startAgentRuntimeEventSync() {
    if (started) {
        return;
    }

    started = true;
    refreshAgentRuntimeEventSync();
}
