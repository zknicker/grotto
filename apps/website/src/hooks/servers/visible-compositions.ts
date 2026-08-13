import type { HostedCompositionEvent } from '@tavern/api';

/**
 * Composition is a live-only signal, so a human removed mid-draft can leave one
 * behind. The Server clears it on removal, but that clear is best-effort by
 * design; the durable answer is the member directory. Anyone absent from it is
 * no longer on the Server and cannot still be composing here.
 *
 * An unresolved directory hides nothing — a slow query should not blank out
 * live signals from humans who are perfectly present.
 */
export function visibleCompositions(
    compositions: HostedCompositionEvent[],
    memberUserIds: string[] | undefined
): HostedCompositionEvent[] {
    if (!memberUserIds) {
        return compositions;
    }

    const current = new Set(memberUserIds);

    return compositions.filter((composition) => current.has(composition.actorUserId));
}
