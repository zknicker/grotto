export class CloudAgentWorkConflictError extends Error {
    constructor(message = 'That Cloud Agent nonce already belongs to a different Message.') {
        super(message);
        this.name = 'CloudAgentWorkConflictError';
    }
}

export class CloudAgentAgentNotFoundError extends Error {
    constructor() {
        super('The delegating Agent no longer exists.');
        this.name = 'CloudAgentAgentNotFoundError';
    }
}

export class CloudAgentWorkNotFoundError extends Error {
    constructor() {
        super('That Cloud Agent work does not exist.');
        this.name = 'CloudAgentWorkNotFoundError';
    }
}

export class CloudAgentWorkSettledError extends Error {
    constructor() {
        super('That Cloud Agent work has already settled.');
        this.name = 'CloudAgentWorkSettledError';
    }
}

export class CloudAgentCancelDeniedError extends Error {
    constructor() {
        super('Only the delegating Agent, an Owner, or an Admin may cancel Cloud Agent work.');
        this.name = 'CloudAgentCancelDeniedError';
    }
}
