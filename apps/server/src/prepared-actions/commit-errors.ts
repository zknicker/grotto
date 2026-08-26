export class PreparedActionCommitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PreparedActionCommitError';
    }
}
