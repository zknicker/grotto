import * as z from 'zod';

// Authenticated humans on a runtime. Grotto user ids are the only identity
// key; Clerk ids are an external reference on the user record. See
// specs/identity.md.

export const runtimeUserIdSchema = z.string().regex(/^usr_[A-Za-z0-9_-]+$/);

export const runtimeUserSchema = z.object({
    avatarUrl: z.string().nullable(),
    clerkUserId: z.string().min(1),
    createdAt: z.string().datetime(),
    email: z.string().nullable(),
    id: runtimeUserIdSchema,
    name: z.string().nullable(),
    updatedAt: z.string().datetime(),
});

export const runtimeMemberRoleSchema = z.enum(['owner', 'member']);

export const runtimeMemberSchema = z.object({
    createdAt: z.string().datetime(),
    role: runtimeMemberRoleSchema,
    user: runtimeUserSchema,
});

// role is null for a verified user who is not (yet) a member.
export const runtimeIdentityMeSchema = z.object({
    role: runtimeMemberRoleSchema.nullable(),
    user: runtimeUserSchema,
});

export const runtimeInviteSchema = z.object({
    code: z.string().min(1),
    createdAt: z.string().datetime(),
    createdBy: runtimeUserIdSchema,
    id: z.string().regex(/^inv_[A-Za-z0-9_-]+$/),
    redeemedAt: z.string().datetime().nullable(),
    redeemedBy: runtimeUserIdSchema.nullable(),
});

export const runtimeInviteRedeemRequestSchema = z.object({
    code: z.string().trim().min(1),
});

export const runtimeMemberListSchema = z.object({
    members: z.array(runtimeMemberSchema),
});

export const runtimeInviteListSchema = z.object({
    invites: z.array(runtimeInviteSchema),
});

export const runtimeInviteCreateResultSchema = z.object({
    invite: runtimeInviteSchema,
});

export const runtimeIdentityMutationResultSchema = z.object({
    ok: z.literal(true),
});

export type RuntimeUser = z.infer<typeof runtimeUserSchema>;
export type RuntimeMemberRole = z.infer<typeof runtimeMemberRoleSchema>;
export type RuntimeMember = z.infer<typeof runtimeMemberSchema>;
export type RuntimeIdentityMe = z.infer<typeof runtimeIdentityMeSchema>;
export type RuntimeInvite = z.infer<typeof runtimeInviteSchema>;
export type RuntimeMemberList = z.infer<typeof runtimeMemberListSchema>;
export type RuntimeInviteList = z.infer<typeof runtimeInviteListSchema>;
export type RuntimeInviteCreateResult = z.infer<typeof runtimeInviteCreateResultSchema>;
export type RuntimeIdentityMutationResult = z.infer<typeof runtimeIdentityMutationResultSchema>;
