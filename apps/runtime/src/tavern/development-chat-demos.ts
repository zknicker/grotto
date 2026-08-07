import type { TavernCreateMessageRequest } from '@tavern/api';
import {
    developmentChatTeamDemoId,
    obsoleteDevelopmentChatDemoIds,
} from '@tavern/api/development-chat-demos';
import type { Database } from '../db/sqlite';
import { namedParams } from '../db/sqlite';
import { createRuntimeAgent } from './agent-create';
import { listStoredAgents } from './agents-store';
import { createChat, createMessage, getMessage, promoteMessageToTask } from './chat-api';
import { developmentChatDemos } from './development-chat-demo-definitions';
import {
    type DemoAgentIds,
    type DevelopmentDemoMessage,
    demoAgentNames,
    demoOwnerParticipantId,
    demoUserHandle,
    demoUserParticipantId,
} from './development-chat-demo-types';
import { createReminder, listReminders } from './reminder-store';

// Seeding is create-only for rows a user or real turn may have touched:
// existing dev DBs keep their chat titles and any already-observed participant
// labels (throwaway data — reseeding never retitles or relabels them). Handle
// hygiene for fresh seeds is locked by the seed-lint cases in
// development-chat-demos.test.ts.
export function shouldSeedDevelopmentChatDemos() {
    return process.env.TAVERN_DEV_STACK === '1' && process.env.TAVERN_HOSTED_DEV_STACK !== '1';
}

export async function seedDevelopmentChatDemos({
    db,
    enabled = shouldSeedDevelopmentChatDemos(),
}: {
    db: Database;
    enabled?: boolean;
}): Promise<{ agentIds: DemoAgentIds | null; seeded: number }> {
    if (!enabled) {
        return { agentIds: null, seeded: 0 };
    }

    // Demo agents go through the normal creation path — generated ids,
    // ordinary factory state — and are resolved by name on reseed.
    const agentIds: DemoAgentIds = {
        otto: (await ensureDemoAgent(db, demoAgentNames.otto, { isAdmin: true })).id,
        wren: (await ensureDemoAgent(db, demoAgentNames.wren)).id,
    };
    pruneObsoleteDevelopmentDemoChats(db);

    const demos = developmentChatDemos(agentIds);
    for (const demo of demos) {
        createChat(
            {
                id: demo.chatId,
                metadata: tavernChatMetadata({
                    agentIds: demo.agentIds,
                    color: demo.color ?? null,
                    displayName: demo.title,
                    id: demo.chatId,
                }),
                title: demo.title,
            },
            db
        );

        for (const message of demo.messages) {
            seedMessage(demo.chatId, message, db);
        }
    }

    seedDemoTaskAndReminder(db, agentIds);

    return { agentIds, seeded: demos.length };
}

async function ensureDemoAgent(db: Database, name: string, options: { isAdmin?: boolean } = {}) {
    const existing = listStoredAgents(db).agents.find((agent) => agent.name === name);
    if (existing) {
        return existing;
    }
    return await createRuntimeAgent({ db, isAdmin: options.isAdmin ?? false, name });
}

// Populate the Tasks and Reminders surfaces on a fresh reseed so both are
// reviewable in dev. Metadata only: no receipt system message and no wake, so
// seeding never spends a model turn. Idempotent by construction — the task
// keys on its anchor message, the reminder on the owner's existing rows.
function seedDemoTaskAndReminder(db: Database, agentIds: DemoAgentIds) {
    const anchorId = 'msg_demo_team_request';
    if (!getMessage(anchorId, db)) {
        return;
    }
    const hasTask = db
        .prepare('SELECT 1 FROM message_tasks WHERE message_id = $anchorId')
        .get(namedParams({ anchorId })) as unknown;
    if (!hasTask) {
        // The owner reserves the weekly review for Wren: a todo task the
        // assignee must still claim (D8 reservation semantics).
        promoteMessageToTask(
            {
                actorId: demoOwnerParticipantId,
                assigneeId: agentIds.wren,
                messageId: anchorId,
                origin: 'converted',
            },
            db
        );
    }
    if (listReminders({ ownerAgentId: agentIds.otto }, db).length === 0) {
        createReminder(
            {
                anchorChatId: developmentChatTeamDemoId,
                anchorMessageId: anchorId,
                fireAtMs: Date.parse('2026-06-19T16:00:00.000Z'),
                ownerAgentId: agentIds.otto,
                repeat: 'weekly:mon@09:00',
                title: 'Check the release-note draft before the weekly review',
            },
            db
        );
    }
}

function pruneObsoleteDevelopmentDemoChats(db: Database) {
    const transaction = db.transaction(() => {
        for (const chatId of obsoleteDevelopmentChatDemoIds) {
            const params = namedParams({ chatId });

            db.prepare('DELETE FROM chat_artifacts WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_response_activity WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_responses WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_deliveries WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_reads WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_events WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_messages WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chat_participants WHERE chat_id = $chatId').run(params);
            db.prepare('DELETE FROM chats WHERE id = $chatId').run(params);
        }
    });

    transaction();
}

function seedMessage(chatId: string, input: DevelopmentDemoMessage, db: Database) {
    if (getMessage(input.id, db)) {
        upsertDemoParticipant(chatId, input.author_id, input.role, db);
        db.prepare(
            `UPDATE chat_messages
             SET author_id = $authorId,
                 role = $role,
                 content = $content,
                 attachment_json = $attachmentJson,
                 nonce = $nonce,
                 metadata_json = $metadataJson,
                 deleted_at = NULL
             WHERE id = $id`
        ).run(
            namedParams({
                attachmentJson:
                    input.attachments === undefined || input.attachments.length === 0
                        ? null
                        : JSON.stringify(input.attachments),
                authorId: input.author_id,
                content: input.content,
                id: input.id,
                metadataJson: JSON.stringify(input.metadata ?? {}),
                nonce: input.nonce ?? null,
                role: input.role,
            })
        );
        setMessageTimestamp(input.id, input.createdAt, db);
        return;
    }

    createMessage(chatId, input, db);
    // createMessage registers the author with a NULL label; the stamp runs
    // after it on both paths so fresh seeds carry handles too.
    upsertDemoParticipant(chatId, input.author_id, input.role, db);
    setMessageTimestamp(input.id, input.createdAt, db);
}

// Human seats get real handles so grotto CLI envelopes render `@Sam` / `@You`
// instead of `@unknown` (agent senders resolve via their stored agents). The
// stamp only fills missing labels; an already-observed label stays put.
function upsertDemoParticipant(
    chatId: string,
    id: string,
    role: TavernCreateMessageRequest['role'],
    db: Database
) {
    db.prepare(
        `INSERT INTO chat_participants (chat_id, id, kind, label, metadata_json)
         VALUES ($chatId, $id, $kind, $label, '{}')
         ON CONFLICT(chat_id, id) DO UPDATE
         SET kind = excluded.kind,
             label = COALESCE(chat_participants.label, excluded.label)`
    ).run(
        namedParams({
            chatId,
            id,
            kind: role === 'assistant' ? 'agent' : role,
            label: demoHumanLabel(id, role),
        })
    );
}

function demoHumanLabel(id: string, role: TavernCreateMessageRequest['role']): string | null {
    if (role !== 'user') {
        return null;
    }
    if (id === demoUserParticipantId) {
        return demoUserHandle;
    }
    // The operator's keyless seat carries the same label the server and DM
    // bootstrap stamp elsewhere.
    return id === demoOwnerParticipantId ? 'You' : null;
}

function setMessageTimestamp(messageId: string, timestamp: string, db: Database) {
    db.prepare('UPDATE chat_messages SET created_at = $timestamp WHERE id = $messageId').run(
        namedParams({ messageId, timestamp })
    );
}

function tavernChatMetadata(input: {
    agentIds: string[];
    color: string | null;
    displayName: string;
    id: string;
}) {
    return {
        runtime: {
            source: 'tavern',
        },
        sessionKeys: input.agentIds.map((agentId) => tavernSessionKey(agentId, input.id)),
        tavern: {
            agentIds: input.agentIds,
            archived: false,
            displayName: input.displayName,
            displayNameSource: 'explicit',
            tabAppearance: { color: input.color },
        },
    };
}

function tavernSessionKey(agentId: string, chatId: string) {
    return `agent:${agentId}:tavern:channel:${chatId}`;
}
