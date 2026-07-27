/**
 * Whether a failed Server subscription means this human has lost access rather
 * than lost the socket. The Server rechecks membership before every delivery, so
 * a departure surfaces here as a refusal — and the App must drop what it has
 * cached, because a dropped connection and a revoked membership look identical
 * from the outside otherwise.
 *
 * Only an explicit refusal counts. A closed socket or a Server error is
 * transient, and clearing rendered Chats on either would make an ordinary
 * reconnect look like being thrown out.
 */
export function isMembershipLoss(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('data' in error)) {
        return false;
    }

    const { data } = error as { data: unknown };

    if (typeof data !== 'object' || data === null || !('code' in data)) {
        return false;
    }

    const { code } = data as { code: unknown };

    return code === 'FORBIDDEN' || code === 'NOT_FOUND';
}
