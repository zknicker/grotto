import type {
    AgentCreateAgentInput,
    AgentCreateAgentReceipt,
    AgentCreatedAvatarOutcome,
    AgentReasoningEffort,
    AvatarMediaType,
    ServerDurableEvent,
} from '@grotto/api';
import { and, eq } from 'drizzle-orm';
import { assertFreshAgentView } from '../agent-api/chat-freshness.ts';
import type { AgentDelivery } from '../agent-delivery/delivery.ts';
import type { AvatarBytes } from '../avatars/avatar-bytes.ts';
import {
    findAgentMessageByNonce,
    planAgentAuthoredMessage,
    writeAgentAuthoredMessage,
} from '../chats/agent-authored-message.ts';
import { resolveAgentDmOwnerUserId } from '../chats/agent-dm-owner.ts';
import { canonicalizeAgentMessageContentForPersistence } from '../chats/canonicalize-agent-references.ts';
import { ensureAgentDmRecord } from '../chats/ensure-agent-dm.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { agentsTable } from '../postgres/schema.ts';
import { suggestAvailableParticipantHandle } from '../servers/participant-handles.ts';
import { lockServerRow } from '../servers/server-lock.ts';
import { readCreatedAgent, readCreatedAgentForMessage } from './agent-created-shape.ts';
import { createAgentInTransaction } from './create-agent.ts';
import { assertAnnouncementNamesHandle } from './creation-announcement.ts';
import {
    channelMembershipEvents,
    joinCreationChannels,
    readAgentChannels,
    requireCreationChannels,
} from './creation-channels.ts';
import { AgentCreateConflictError, AgentCreateNoComputerError } from './errors.ts';

/** The avatar decision the route already made, generated outside this transaction. */
export interface CreationAvatar {
    bytes: (AvatarBytes & { mediaType: AvatarMediaType }) | null;
    outcome: AgentCreatedAvatarOutcome;
}

/** What the Computer must apply after the transaction commits. */
export interface AgentCreationConfiguration {
    agentDescription: string;
    agentId: string;
    agentName: string;
    computerId: string;
    modelId: string;
    reasoningEffort: AgentReasoningEffort;
    runtimeId: string;
}

export interface CreateAgentFromAgentResult {
    configure: AgentCreationConfiguration | null;
    events: ServerDurableEvent[];
    receipt: AgentCreateAgentReceipt;
    wakes: Array<{ agentId: string; serverId: string }>;
}

/**
 * One Agent creates another: the Agent-authored Message that announces it, the
 * Agent row linked back to that Message, the deterministic child Thread,
 * delivery planning, and `message.created` — all in one transaction, idempotent
 * by the message nonce. The new Agent inherits the caller's Computer, runtime,
 * model, and reasoning effort, re-validated against that Computer's reported
 * inventory. Avatar bytes are generated before this call, never inside it.
 */
export async function createAgentFromAgent(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    input: AgentCreateAgentInput,
    agentDelivery: AgentDelivery,
    avatar: CreationAvatar
): Promise<CreateAgentFromAgentResult> {
    return await db.transaction(async (tx) => {
        await lockServerRow(tx, runner.serverId);
        const plan = await planAgentAuthoredMessage(tx, runner, input.target);

        const replay = await readReplay(tx, runner, plan.chatId, input);
        if (replay) {
            return { configure: null, events: [], receipt: replay, wakes: [] };
        }

        await assertFreshAgentView(tx, runner, plan.chatId);
        // Nothing is written until every requested channel is there to join, so
        // a typo in `--channel` costs no Agent, no Message, and no avatar.
        const channels = await requireCreationChannels(tx, runner.serverId, input.channels);
        const execution = await requireCallerExecution(tx, runner);
        // The Server is authoritative for handles: this runs under the Server row
        // lock, scans live Agents and humans alike, and suffixes on collision.
        // The pre-check outside this transaction read the same rule without the
        // lock, so this is the answer that decides.
        const handle = await suggestAvailableParticipantHandle(
            tx,
            runner.serverId,
            input.displayName
        );
        assertAnnouncementNamesHandle(input.content, handle);

        // The new Agent's id has to exist before its own announcement is written,
        // because the `@handle` in that announcement is the reader's way to it.
        const agentId = createOpaqueId('agt');
        const content = await canonicalizeAgentMessageContentForPersistence(tx, {
            additionalAgents: [{ handle, id: agentId }],
            content: input.content,
            serverId: runner.serverId,
        });

        const written = await writeAgentAuthoredMessage(
            tx,
            runner,
            plan,
            { bodyKind: 'agent-created', content, nonce: input.nonce },
            agentDelivery
        );
        const created = await createAgentInTransaction(
            tx,
            { agentId: runner.agentId, kind: 'agent' },
            {
                agentId,
                brief: input.brief,
                computerId: execution.computerId,
                creationMessageId: written.messageId,
                description: input.description,
                displayName: input.displayName,
                handle,
                modelId: execution.modelId,
                reasoningEffort: execution.reasoningEffort,
                runtimeId: execution.runtimeId,
                serverId: runner.serverId,
            },
            avatar.bytes
        );

        // No human created this Agent, so nothing else can name the human its
        // Owner DM belongs to. Materialize that DM record here — it carries no
        // message, so the DM still becomes a visible Chat on its first one, and
        // the human has a place to talk to the new Agent from the start.
        const dmOwnerUserId = await resolveAgentDmOwnerUserId(tx, {
            contextChatId: plan.chat.kind === 'thread' ? plan.chat.parentChatId : plan.chatId,
            creatorAgentId: runner.agentId,
            serverId: runner.serverId,
        });
        if (dmOwnerUserId) {
            await ensureAgentDmRecord(tx, {
                agentId: created.agent.id,
                serverId: runner.serverId,
                userId: dmOwnerUserId,
            });
        }

        // `#all` is joined by the shared creation seam; these are the lanes the
        // request named on top of it.
        await joinCreationChannels(tx, runner.serverId, created.agent.id, channels);
        const joined = await readAgentChannels(tx, runner.serverId, created.agent.id);

        const summary = await readCreatedAgent(tx, runner.serverId, created.agent.id);
        if (!summary) {
            throw new Error('The created Agent could not be projected after creation.');
        }

        return {
            configure: {
                agentDescription: input.description,
                agentId: created.agent.id,
                agentName: input.displayName,
                computerId: execution.computerId,
                modelId: execution.modelId,
                reasoningEffort: execution.reasoningEffort,
                runtimeId: execution.runtimeId,
            },
            events: [
                written.event,
                ...(await channelMembershipEvents(tx, runner.serverId, joined)),
            ],
            receipt: {
                agent: summary,
                avatar: avatar.outcome,
                channels: joined.map((channel) => `#${channel.name}`),
                chatId: plan.chatId,
                computerId: execution.computerId,
                idempotent: false,
                messageId: written.messageId,
                modelId: execution.modelId,
                reasoningEffort: execution.reasoningEffort,
                runtimeId: execution.runtimeId,
                sequence: written.sequence,
                target: input.target,
            },
            wakes: written.wakes,
        };
    });
}

/**
 * A retried create must find the same Message carrying the same Agent, or the
 * nonce is being reused for a different creation and the request is refused.
 *
 * The replay reports no avatar of its own. A retry that raced the first attempt
 * passed the route's pre-check before that attempt committed, so it generated an
 * image and then found the nonce here; those bytes are dropped, and reporting
 * them would claim this request illustrated an Agent it never touched. The
 * Agent summary already carries the avatar it actually wears.
 */
async function readReplay(
    db: GrottoDatabase,
    runner: ResolvedRunner,
    chatId: string,
    input: AgentCreateAgentInput
): Promise<AgentCreateAgentReceipt | null> {
    const message = await findAgentMessageByNonce(db, {
        chatId,
        nonce: input.nonce,
        serverId: runner.serverId,
    });
    if (!message) {
        return null;
    }
    const agent = await readCreatedAgentForMessage(db, runner.serverId, message.id);
    // The stored announcement carries stable reference links, so the retry's raw
    // text is canonicalized against the targets already in it before comparison.
    const content = await canonicalizeAgentMessageContentForPersistence(db, {
        content: input.content,
        existingContent: message.content,
        serverId: runner.serverId,
    });
    if (
        !agent ||
        message.authorAgentId !== runner.agentId ||
        message.content !== content ||
        agent.displayName !== input.displayName ||
        agent.description !== input.description
    ) {
        throw new AgentCreateConflictError();
    }
    const execution = await requireCallerExecution(db, runner);
    return {
        agent,
        avatar: { status: 'none' },
        channels: (await readAgentChannels(db, runner.serverId, agent.agentId)).map(
            (channel) => `#${channel.name}`
        ),
        chatId,
        computerId: execution.computerId,
        idempotent: true,
        messageId: message.id,
        modelId: execution.modelId,
        reasoningEffort: execution.reasoningEffort,
        runtimeId: execution.runtimeId,
        sequence: message.sequence,
        target: input.target,
    };
}

/** The new Agent inherits exactly what the creating Agent runs on. */
async function requireCallerExecution(
    db: Pick<GrottoDatabase, 'select'>,
    runner: ResolvedRunner
): Promise<{
    computerId: string;
    modelId: string;
    reasoningEffort: AgentReasoningEffort;
    runtimeId: string;
}> {
    const [caller] = await db
        .select({
            computerId: agentsTable.computerId,
            modelId: agentsTable.desiredModelId,
            reasoningEffort: agentsTable.desiredReasoningEffort,
            runtimeId: agentsTable.desiredRuntimeId,
        })
        .from(agentsTable)
        .where(and(eq(agentsTable.serverId, runner.serverId), eq(agentsTable.id, runner.agentId)))
        .limit(1);
    if (!(caller?.computerId && caller.modelId && caller.runtimeId)) {
        throw new AgentCreateNoComputerError();
    }
    return {
        computerId: caller.computerId,
        modelId: caller.modelId,
        reasoningEffort: caller.reasoningEffort,
        runtimeId: caller.runtimeId,
    };
}
