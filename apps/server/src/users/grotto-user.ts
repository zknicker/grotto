import { eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { createOpaqueId } from '../postgres/opaque-id.ts';
import { usersTable } from '../postgres/schema.ts';

export interface GrottoUser {
    clerkUserId: string;
    id: string;
}

type UserReader = Pick<GrottoDatabase, 'select'>;
type UserWriter = UserReader & Pick<GrottoDatabase, 'insert'>;

/** The Grotto User behind an authenticated Clerk session, if one exists yet. */
export async function findUserByClerkId(
    db: UserReader,
    clerkUserId: string
): Promise<GrottoUser | null> {
    const [user] = await db
        .select({ clerkUserId: usersTable.clerkUserId, id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.clerkUserId, clerkUserId))
        .limit(1);

    return user ?? null;
}

/**
 * Mints the stable Grotto User for one Clerk user. Only Server creation calls
 * this, inside its own transaction, so a rolled-back creation leaves no User
 * behind. The unique `clerk_user_id` constraint settles concurrent first
 * writes, so the same Clerk user always resolves to the same Grotto User id.
 */
export async function ensureUserByClerkId(
    db: UserWriter,
    clerkUserId: string
): Promise<GrottoUser> {
    await db
        .insert(usersTable)
        .values({ clerkUserId, id: createOpaqueId('usr') })
        .onConflictDoNothing({ target: usersTable.clerkUserId });

    const user = await findUserByClerkId(db, clerkUserId);

    if (!user) {
        throw new Error('Failed to resolve the Grotto User for the authenticated Clerk user.');
    }

    return user;
}
