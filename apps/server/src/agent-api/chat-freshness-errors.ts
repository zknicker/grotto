/**
 * The Chat moved under an Agent between its last read and an irreversible act.
 * Creation is conversation-conditional in a way an edit is not, so this gate
 * guards it alone: the Agent reads the target again and decides afresh.
 */
export class AgentChatViewStaleError extends Error {
    readonly code = 'CHAT_VIEW_STALE';
    readonly status = 409;

    constructor() {
        super('The Chat changed after this Agent last saw it. Read the target and try again.');
        this.name = 'AgentChatViewStaleError';
    }
}
