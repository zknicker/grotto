/** PostgreSQL `unique_violation`. */
const uniqueViolationErrno = '23505';

interface PostgresConstraintError {
    constraint: string;
    errno: string;
}

/**
 * PostgreSQL reports the exact constraint that rejected a write. Drizzle wraps
 * that error, so walk the cause chain to read it.
 */
export function violatesConstraint(error: unknown, constraint: string): boolean {
    for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
        const candidate = cause as unknown as Partial<PostgresConstraintError>;

        if (candidate.errno === uniqueViolationErrno && candidate.constraint === constraint) {
            return true;
        }
    }

    return false;
}
