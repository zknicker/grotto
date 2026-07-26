import { createHash, randomBytes } from 'node:crypto';

/**
 * Invitation tokens are bearer secrets, not record ids: they are wider than an
 * opaque id and never stored in the clear. Grotto keeps only the hash, so the
 * raw token exists in exactly one response.
 */
const tokenByteLength = 32;

export function createInvitationToken(): string {
    return randomBytes(tokenByteLength).toString('base64url');
}

export function hashInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
