import * as z from 'zod';

export function isCommittedSend(body: string): boolean {
    try {
        return z.object({ state: z.literal('sent') }).safeParse(JSON.parse(body)).success;
    } catch {
        return false;
    }
}

const preCommitFailureCodes = new Set([
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'ConnectionRefused',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function isDefinitelyPreCommitFailure(error: unknown): boolean {
    let current = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
        if ('code' in current && preCommitFailureCodes.has(String(current.code))) {
            return true;
        }
        current = 'cause' in current ? current.cause : null;
    }
    return false;
}
