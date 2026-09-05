export class AskConflictError extends Error {
    constructor(message = 'That Ask nonce already belongs to a different Message.') {
        super(message);
        this.name = 'AskConflictError';
    }
}

export class InvalidAskAddresseeError extends Error {
    constructor(
        message = 'The addressee must be an active human Server member with access to this Chat.'
    ) {
        super(message);
        this.name = 'InvalidAskAddresseeError';
    }
}

export class AskAgentNotFoundError extends Error {
    constructor() {
        super('The asking Agent no longer exists.');
        this.name = 'AskAgentNotFoundError';
    }
}
