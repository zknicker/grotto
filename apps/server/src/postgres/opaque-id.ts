import { randomBytes } from 'node:crypto';

const randomByteLength = 12;

/**
 * Record ids are opaque: they carry a readable kind prefix and random bytes,
 * never a slug, name, or sequence a client could guess or parse.
 */
export function createOpaqueId(prefix: string): string {
    return `${prefix}_${randomBytes(randomByteLength).toString('base64url')}`;
}
