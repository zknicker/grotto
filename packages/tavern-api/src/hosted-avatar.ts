import * as z from 'zod';
import { avatarIdSchema, avatarMaxBytes, avatarMediaTypeSchema } from './avatar.ts';

/**
 * Setting an avatar on the hosted Server. Bytes travel base64-encoded on the
 * ordinary tRPC call because an avatar is capped far below the request body
 * limit; nothing about it warrants the attachment reservation dance.
 */
const hostedIdSchema = z.string().trim().min(1);

/** Base64 inflates the byte ceiling by 4/3; the slack covers padding. */
const base64MaxLength = Math.ceil((avatarMaxBytes * 4) / 3) + 8;

export const hostedAvatarTargetSchema = z.discriminatedUnion('kind', [
    z.object({ agentId: hostedIdSchema, kind: z.literal('agent') }).strict(),
    z.object({ kind: z.literal('user') }).strict(),
]);

export type HostedAvatarTarget = z.infer<typeof hostedAvatarTargetSchema>;

export const hostedSetAvatarInputSchema = z
    .object({
        bytesBase64: z
            .string()
            .min(1)
            .max(base64MaxLength)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/u, 'Avatar bytes must be base64.'),
        mediaType: avatarMediaTypeSchema,
        serverId: hostedIdSchema,
        target: hostedAvatarTargetSchema,
    })
    .strict();

export type HostedSetAvatarInput = z.infer<typeof hostedSetAvatarInputSchema>;

export const hostedClearAvatarInputSchema = z
    .object({ serverId: hostedIdSchema, target: hostedAvatarTargetSchema })
    .strict();

export type HostedClearAvatarInput = z.infer<typeof hostedClearAvatarInputSchema>;

/** `avatarUrl` is null only after clearing; it always matches `avatarId`. */
export const hostedAvatarSchema = z
    .object({ avatarId: avatarIdSchema.nullable(), avatarUrl: z.string().nullable() })
    .strict();

export type HostedAvatar = z.infer<typeof hostedAvatarSchema>;
