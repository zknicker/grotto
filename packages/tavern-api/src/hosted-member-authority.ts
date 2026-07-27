import * as z from 'zod';

/**
 * Human standing on a Grotto server. Only humans hold Owner, a Server may have
 * several, and it must always keep one.
 */
export const serverRoleSchema = z.enum(['owner', 'admin', 'member']);

export type ServerRole = z.infer<typeof serverRoleSchema>;

/** What one human is trying to do to one Server membership. */
export type ServerMemberAction =
    | { kind: 'changeRole'; nextRole: ServerRole }
    | { kind: 'leave' }
    | { kind: 'remove' };

export interface ServerMemberAuthorityRequest {
    action: ServerMemberAction;
    actorRole: ServerRole;
    actorUserId: string;
    /** The target is the only Owner this Server has left. */
    targetIsLastOwner: boolean;
    targetRole: ServerRole;
    targetUserId: string;
}

/**
 * Why a management action was refused. The App renders these as the reason an
 * affordance is unavailable, so the Server and the App must agree on one set.
 */
export type ServerMemberAuthorityRefusal =
    | 'last-owner'
    | 'no-op'
    | 'not-self'
    | 'peer-or-higher'
    | 'requires-admin'
    | 'requires-owner'
    | 'self-promotion'
    | 'use-leave';

export type ServerMemberAuthority =
    | { allowed: false; reason: ServerMemberAuthorityRefusal }
    | { allowed: true };

/** Owners and Admins issue and revoke Server invitations. */
export function canManageServerInvitations(role: ServerRole): boolean {
    return role === 'owner' || role === 'admin';
}

/**
 * Granting authority and taking access away both ask the human to type the
 * Server's immutable address, matching the danger-zone interaction Grotto
 * already uses. That covers every elevation — Member to Admin as much as
 * Member or Admin to Owner — plus removal, leaving, and revoking Owner.
 *
 * Stepping an Admin down to Member is the one ordinary confirmation: it grants
 * nothing and costs no access, so it does not deserve the same friction.
 */
export function requiresSlugConfirmation(
    action: ServerMemberAction,
    targetRole: ServerRole
): boolean {
    if (action.kind === 'leave' || action.kind === 'remove') {
        return true;
    }

    const isElevation = roleRank[action.nextRole] > roleRank[targetRole];

    return isElevation || targetRole === 'owner';
}

/**
 * The one Owner/Admin/Member authority rule, shared by the hosted Server and
 * the App so a rendered affordance can never disagree with the Server that
 * judges it. The Server still re-resolves this inside its transaction; the App
 * uses it for presentation only.
 *
 * Refusal order is deliberate. Self-actions are judged before rank, so a human
 * stepping down is never told they lack authority over themselves, and
 * authority is judged before anything is reported about the target, so an
 * unauthorized human learns only that they lack authority.
 */
export function resolveServerMemberAuthority(
    request: ServerMemberAuthorityRequest
): ServerMemberAuthority {
    if (request.action.kind === 'leave') {
        return resolveLeave(request);
    }

    if (request.action.kind === 'remove') {
        return resolveRemoval(request);
    }

    return resolveRoleChange(request, request.action.nextRole);
}

const roleRank: Record<ServerRole, number> = { admin: 2, member: 1, owner: 3 };

const allowed: ServerMemberAuthority = { allowed: true };

function refuse(reason: ServerMemberAuthorityRefusal): ServerMemberAuthority {
    return { allowed: false, reason };
}

function isSelf(request: ServerMemberAuthorityRequest) {
    return request.actorUserId === request.targetUserId;
}

function resolveLeave(request: ServerMemberAuthorityRequest): ServerMemberAuthority {
    if (!isSelf(request)) {
        return refuse('not-self');
    }

    return request.targetIsLastOwner ? refuse('last-owner') : allowed;
}

function resolveRemoval(request: ServerMemberAuthorityRequest): ServerMemberAuthority {
    if (isSelf(request)) {
        return request.targetIsLastOwner ? refuse('last-owner') : refuse('use-leave');
    }

    const authority = resolveTargetAuthority(request, request.targetRole);

    if (!authority.allowed) {
        return authority;
    }

    return request.targetIsLastOwner ? refuse('last-owner') : allowed;
}

function resolveRoleChange(
    request: ServerMemberAuthorityRequest,
    nextRole: ServerRole
): ServerMemberAuthority {
    if (isSelf(request)) {
        if (nextRole === request.targetRole) {
            return refuse('no-op');
        }

        // Stepping down is always available; nobody grants themselves more.
        if (roleRank[nextRole] > roleRank[request.targetRole]) {
            return refuse('self-promotion');
        }

        return request.targetIsLastOwner ? refuse('last-owner') : allowed;
    }

    const authority = resolveTargetAuthority(request, request.targetRole, nextRole);

    if (!authority.allowed) {
        return authority;
    }

    if (nextRole === request.targetRole) {
        return refuse('no-op');
    }

    return request.targetIsLastOwner ? refuse('last-owner') : allowed;
}

/**
 * Owner authority is Owner-only in both directions. Otherwise an Admin reaches
 * strictly below their own rank, and an Owner reaches anyone.
 */
function resolveTargetAuthority(
    request: ServerMemberAuthorityRequest,
    targetRole: ServerRole,
    nextRole?: ServerRole
): ServerMemberAuthority {
    if (request.actorRole === 'member') {
        return refuse('requires-admin');
    }

    const touchesOwner = targetRole === 'owner' || nextRole === 'owner';

    if (touchesOwner && request.actorRole !== 'owner') {
        return refuse('requires-owner');
    }

    if (request.actorRole === 'admin' && roleRank[targetRole] >= roleRank[request.actorRole]) {
        return refuse('peer-or-higher');
    }

    return allowed;
}
