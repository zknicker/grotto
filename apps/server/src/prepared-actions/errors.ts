export class PreparedActionConflictError extends Error {
    constructor(message = 'That action nonce already belongs to a different proposal.') {
        super(message);
        this.name = 'PreparedActionConflictError';
    }
}

export class PreparedActionStaleViewError extends Error {
    readonly code = 'ACTION_VIEW_STALE';
    readonly status = 409;

    constructor() {
        super('The Chat changed after this Agent last saw it. Read the target and prepare again.');
        this.name = 'PreparedActionStaleViewError';
    }
}
