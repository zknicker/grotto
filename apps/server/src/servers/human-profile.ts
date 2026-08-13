import type { ServerMember, SyncHumanIdentityInput, UpdateHumanProfileInput } from '@tavern/api';
import { eq } from 'drizzle-orm';
import type { GrottoDatabase } from '../postgres/connection.ts';
import { usersTable } from '../postgres/schema.ts';
import type { GrottoUser } from '../users/grotto-user.ts';

/**
 * Seeds a human's profile from the Clerk identity the App reports. It only
 * fills blanks: once a human has chosen a display name it is theirs, and a
 * later sign-in must not overwrite it with the Clerk value.
 */
export async function syncHumanIdentity(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: SyncHumanIdentityInput
): Promise<void> {
    if (!member) {
        throw new Error('Signing in is required to sync a human profile.');
    }

    const [existing] = await db
        .select({ displayName: usersTable.displayName, handle: usersTable.handle })
        .from(usersTable)
        .where(eq(usersTable.id, member.id));

    if (!existing) {
        return;
    }

    const displayName = existing.displayName ?? input.name?.trim() ?? null;

    await db
        .update(usersTable)
        .set({
            displayName: displayName && displayName.length > 0 ? displayName : null,
            email: input.email?.trim() || null,
            handle: existing.handle ?? deriveHandle(displayName, input.email),
        })
        .where(eq(usersTable.id, member.id));
}

/** A human edits only their own profile. */
export async function updateHumanProfile(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: UpdateHumanProfileInput
): Promise<void> {
    if (!member) {
        throw new Error('Signing in is required to edit a human profile.');
    }

    await db
        .update(usersTable)
        .set({ description: input.description, displayName: input.displayName })
        .where(eq(usersTable.id, member.id));
}

export function humanMemberLabel(member: Pick<ServerMember, 'displayName' | 'userId'>): string {
    return member.displayName ?? `Human ${member.userId.slice(-6)}`;
}

/**
 * A first handle guess from the name or email local-part. Humans keep whatever
 * they are first given; collisions are left to a later rename flow rather than
 * silently numbering people.
 */
function deriveHandle(displayName: null | string, email: null | string): null | string {
    const source = displayName ?? email?.split('@')[0] ?? null;

    if (!source) {
        return null;
    }

    const handle = source
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '')
        .slice(0, 32);

    return handle.length > 0 ? handle : null;
}
