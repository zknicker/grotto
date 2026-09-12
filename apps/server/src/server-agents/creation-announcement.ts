import type { AgentCreateAgentInput } from '@haus/api';
import { resolveAgentSendTarget } from '../agent-api/resolve-send-target.ts';
import { findAgentMessageByNonce } from '../chats/agent-authored-message.ts';
import { mentionsBareAgentHandle } from '../chats/bare-reference-tokens.ts';
import type { ResolvedRunner } from '../computers/runner-credentials.ts';
import type { HausDatabase } from '../postgres/connection.ts';
import { suggestAvailableParticipantHandle } from '../servers/participant-handles.ts';
import { requireCreationChannels } from './creation-channels.ts';
import { AgentCreateAnnouncementMissingHandleError } from './errors.ts';

/**
 * The announcement is the only place a human is offered the new Agent, so it
 * has to name it: `@handle` in ordinary prose becomes the inline mention chip
 * that opens the profile, exactly as it does for any other Agent.
 */
export function assertAnnouncementNamesHandle(content: string, handle: string): void {
    if (!mentionsBareAgentHandle(content, handle)) {
        throw new AgentCreateAnnouncementMissingHandleError(handle);
    }
}

/** What the route learned before opening the transaction. */
export interface AgentCreationPrecheck {
    /** The nonce already carries a creation, so this request creates nothing. */
    replayed: boolean;
}

/**
 * The refusals a create can reach without the Server row lock, so a request
 * that cannot succeed is turned away before it spends an avatar generation: an
 * announcement that names nobody, and a `--channel` that names no open channel.
 * A retry of a creation that already happened skips both: the stored Message
 * settles that request, and the derived handle would have moved on. It also
 * spends no generation, because the Agent it would illustrate already exists.
 */
export async function precheckAgentCreation(
    db: HausDatabase,
    runner: ResolvedRunner,
    input: AgentCreateAgentInput
): Promise<AgentCreationPrecheck> {
    const chatId = await resolveAgentSendTarget(db, runner, input.target);
    const replay = await findAgentMessageByNonce(db, {
        chatId,
        nonce: input.nonce,
        serverId: runner.serverId,
    });
    if (replay) {
        return { replayed: true };
    }
    assertAnnouncementNamesHandle(
        input.content,
        await suggestAvailableParticipantHandle(db, runner.serverId, input.displayName)
    );
    await requireCreationChannels(db, runner.serverId, input.channels);
    return { replayed: false };
}
