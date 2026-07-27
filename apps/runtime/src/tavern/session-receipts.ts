import { createAgentParticipantId, createMessageId } from './chat-api/ids.ts';
import { createMessage, listChatsForAgentParticipant } from './chat-api/index.ts';

// Why a rotation happened, carried on the receipt so the activity feed reads
// intent from metadata instead of parsing display text (agent-activity.ts).
export type SessionRotationReason = 'full' | 'recovery' | 'session';

// A session rotation lands a durable system message in the agent's built-in
// DM — the agent's home surface — since the rotation is agent-scoped, not
// chat-scoped (specs/sessions.md). Manual resets and automatic resume recovery
// share this receipt; only the reason and text differ.
export function recordSessionRotationReceipt(input: {
    agentId: string;
    reason: SessionRotationReason;
    sessionId: string;
    text: string;
}) {
    const participantId = createAgentParticipantId(input.agentId);
    const dm = listChatsForAgentParticipant(participantId).find((chat) => chat.kind === 'dm');
    if (!dm) {
        return;
    }
    createMessage(dm.id, {
        author_id: 'sys_session_reset',
        content: input.text,
        id: createMessageId(),
        metadata: {
            runtime: {
                agentId: input.agentId,
                notice: 'new_session',
                reason: input.reason,
                sessionId: input.sessionId,
                source: input.reason === 'recovery' ? 'resume-recovery' : 'session-reset',
            },
        },
        role: 'system',
    });
}
