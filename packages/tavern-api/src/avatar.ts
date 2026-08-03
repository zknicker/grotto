import * as z from 'zod';

// One avatar vocabulary for every identity — agents and people alike. An
// avatar is a square image the user uploads, or nothing at all (surfaces then
// fall back to initials).
export const avatarMediaTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AvatarMediaType = (typeof avatarMediaTypes)[number];

export const avatarMediaTypeSchema = z.enum(avatarMediaTypes);

/** Upload ceiling, checked after the client resize. */
export const avatarMaxBytes = 512 * 1024;

/** Clients resize to this square before upload; nothing stores the original. */
export const avatarPixelSize = 256;

export const avatarIdSchema = z.string().regex(/^avt_[a-z0-9]{16}$/u);

export type AvatarId = z.infer<typeof avatarIdSchema>;

export function isAvatarId(value: unknown): value is AvatarId {
    return avatarIdSchema.safeParse(value).success;
}
