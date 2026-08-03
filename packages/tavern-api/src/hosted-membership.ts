import * as z from 'zod';
import { serverRoleSchema } from './hosted-member-authority.ts';

/**
 * The hosted membership contract: invitations, the member directory, and the
 * management inputs. The Owner/Admin/Member rule those inputs are judged by
 * lives in `hosted-member-authority.ts` and is re-exported here, so this module
 * is the one entrypoint both the Server and the App import.
 */
export * from './hosted-member-authority.ts';

const hostedIdSchema = z.string().trim().min(1);
const hostedTimestampSchema = z.iso.datetime({ offset: true });

/**
 * One human's standing on one Server, as the App's member directory shows it.
 * Identity fields are nullable: a human who has never opened the App has a
 * membership but no profile yet, and the App falls back to a derived label.
 */
export const serverMemberSchema = z
    .object({
        avatarUrl: z.string().nullable(),
        description: z.string().nullable(),
        displayName: z.string().nullable(),
        email: z.string().nullable(),
        handle: z.string().nullable(),
        joinedAt: hostedTimestampSchema,
        role: serverRoleSchema,
        userId: hostedIdSchema,
    })
    .strict();

export type ServerMember = z.infer<typeof serverMemberSchema>;

export const humanDisplayNameSchema = z.string().trim().min(1).max(80);
export const humanDescriptionSchema = z.string().trim().max(500);

/**
 * The App reports the signed-in human's Clerk identity so the Server can seed
 * a profile. It never overwrites a name the human has since chosen.
 */
export const hostedSyncHumanIdentityInputSchema = z
    .object({
        email: z.string().trim().max(320).nullable(),
        name: z.string().trim().max(80).nullable(),
    })
    .strict();

export type HostedSyncHumanIdentityInput = z.infer<typeof hostedSyncHumanIdentityInputSchema>;

/** A human edits only their own profile; the Server judges that from the caller. */
export const hostedUpdateHumanProfileInputSchema = z
    .object({
        description: humanDescriptionSchema.nullable(),
        displayName: humanDisplayNameSchema,
    })
    .strict();

export type HostedUpdateHumanProfileInput = z.infer<typeof hostedUpdateHumanProfileInputSchema>;

/**
 * The directory carries the viewer's own identity and role, so the App renders
 * affordances from one server-derived source instead of stitching queries.
 */
export const serverMemberDirectorySchema = z
    .object({
        members: z.array(serverMemberSchema),
        viewerRole: serverRoleSchema,
        viewerUserId: hostedIdSchema,
    })
    .strict();

export type ServerMemberDirectory = z.infer<typeof serverMemberDirectorySchema>;

export const listServerMembersInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const changeServerMemberRoleInputSchema = z
    .object({
        confirmation: z.string().optional(),
        role: serverRoleSchema,
        serverId: hostedIdSchema,
        userId: hostedIdSchema,
    })
    .strict();

export const removeServerMemberInputSchema = z
    .object({
        confirmation: z.string(),
        serverId: hostedIdSchema,
        userId: hostedIdSchema,
    })
    .strict();

export const leaveServerInputSchema = z
    .object({ confirmation: z.string(), serverId: hostedIdSchema })
    .strict();

export const removedServerMemberSchema = z
    .object({ serverId: hostedIdSchema, userId: hostedIdSchema })
    .strict();

/**
 * An invitation address is compared to a verified Clerk email by exact match
 * after trimming and lowercasing. Grotto deliberately does not canonicalize
 * provider-specific forms such as plus tags or dots: Clerk verifies the literal
 * address, so folding them would let one address consume another's invitation.
 */
export const serverInvitationEmailSchema = z.string().trim().toLowerCase().max(320).pipe(z.email());

/** Live invitations are `pending`; the rest are terminal display states. */
export const serverInvitationStatusSchema = z.enum(['accepted', 'expired', 'pending', 'revoked']);

export type ServerInvitationStatus = z.infer<typeof serverInvitationStatusSchema>;

/** What Owners and Admins may see. The token and its hash are never included. */
export const serverInvitationSchema = z
    .object({
        createdAt: hostedTimestampSchema,
        email: z.string().min(1),
        expiresAt: hostedTimestampSchema,
        id: hostedIdSchema,
        invitedByUserId: hostedIdSchema,
        status: serverInvitationStatusSchema,
    })
    .strict();

export type ServerInvitation = z.infer<typeof serverInvitationSchema>;

export const createServerInvitationInputSchema = z
    .object({ email: serverInvitationEmailSchema, serverId: hostedIdSchema })
    .strict();

/**
 * The one and only disclosure of the raw token. Grotto stores only its SHA-256
 * hash, so an issuer who loses this response must revoke and reissue.
 */
export const createdServerInvitationSchema = z
    .object({ invitation: serverInvitationSchema, token: z.string().min(1) })
    .strict();

export const listServerInvitationsInputSchema = z.object({ serverId: hostedIdSchema }).strict();

export const serverInvitationListSchema = z.array(serverInvitationSchema);

export const revokeServerInvitationInputSchema = z
    .object({ invitationId: hostedIdSchema, serverId: hostedIdSchema })
    .strict();

export const serverInvitationTokenInputSchema = z
    .object({ token: z.string().trim().min(1).max(200) })
    .strict();

/**
 * What an invited human sees before accepting. The bound address is absent on
 * purpose: a token holder must not learn whose invitation they are looking at.
 */
export const serverInvitationPreviewSchema = z
    .object({
        emailMatches: z.boolean(),
        serverDisplayName: z.string().min(1),
        serverSlug: z.string().min(1),
    })
    .strict();

export const acceptedServerInvitationSchema = z
    .object({ serverId: hostedIdSchema, serverSlug: z.string().min(1) })
    .strict();
