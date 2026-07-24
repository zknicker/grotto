import type { RuntimeMemberRole, RuntimeUser } from '@tavern/api';
import { runtimeRoutes } from '@tavern/api';
import { getConfiguredClerkVerifier } from './clerk-session.ts';
import { claimOwnershipIfUnclaimed, getMemberRole } from './members.ts';
import { getOrCreateUserByClerkId } from './users.ts';

/**
 * Who a runtime request is acting as. The runtime token is the owner's
 * transport credential and bypasses membership; Clerk-verified users carry
 * their member role (null until they redeem an invite).
 */
export type RuntimeRequestAuth =
    | { kind: 'agent-token'; agentId: string }
    | { kind: 'runtime-token' }
    | { kind: 'user'; role: RuntimeMemberRole | null; user: RuntimeUser };

/**
 * Resolves a Clerk bearer token to a user. Returns null when the token does
 * not verify (or Clerk is not configured). The first verified user to reach
 * an unclaimed runtime becomes its owner (specs/identity.md).
 */
export async function resolveClerkRequestAuth(
    bearerToken: string
): Promise<RuntimeRequestAuth | null> {
    const verifier = getConfiguredClerkVerifier();
    if (!verifier) {
        return null;
    }
    let clerkUserId: string;
    try {
        ({ clerkUserId } = await verifier.verify(bearerToken));
    } catch {
        return null;
    }
    const user = getOrCreateUserByClerkId(clerkUserId);
    claimOwnershipIfUnclaimed(user.id);
    return { kind: 'user', role: getMemberRole(user.id), user };
}

const nonMemberAllowedRoutes = new Set<string>([
    runtimeRoutes.identityMe,
    runtimeRoutes.identityInviteRedeem,
]);

const memberDeniedPrefixes = [
    '/model-access',
    '/agent-env',
    '/mcp',
    '/update',
    '/dev',
    '/timezone',
] as const;

/** Owner credentials retain full access; members receive the app-facing runtime surface. */
export function isRouteAllowedForAuth(
    auth: RuntimeRequestAuth,
    pathname: string,
    method = 'GET'
): boolean {
    if (auth.kind === 'agent-token') {
        return pathname.startsWith('/api/agent/');
    }
    if (pathname.startsWith('/api/agent/')) {
        return false;
    }
    if (auth.kind === 'runtime-token' || auth.role === 'owner') {
        return true;
    }

    if (auth.role === null) {
        return nonMemberAllowedRoutes.has(pathname);
    }

    if (memberDeniedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
        return false;
    }

    if (
        pathname.startsWith('/api/') ||
        pathname === runtimeRoutes.identityMe ||
        pathname === runtimeRoutes.events ||
        pathname === runtimeRoutes.health
    ) {
        return true;
    }

    if (method !== 'GET') {
        return false;
    }

    return (
        pathname === runtimeRoutes.identityMembers ||
        pathname.startsWith('/capabilities') ||
        pathname.startsWith('/agents') ||
        pathname.startsWith('/models') ||
        pathname === runtimeRoutes.macApps
    );
}
