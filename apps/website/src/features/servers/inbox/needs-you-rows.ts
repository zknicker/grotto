import type { TaskItem } from '../tasks/task-model.ts';
import type { NeedsYouAsk } from './needs-you-asks.ts';

/** What every Needs-you row shows, whatever record it projects. */
interface NeedsYouRowFace {
    /** The Agent whose face leads the row: the one asking, or the one that stopped. */
    agentId: null | string;
    avatarUrl: null | string;
    /**
     * The list key, namespaced by kind. An Ask and a stalled claim can name the
     * same Message — nothing stops an ask-bodied Message from being claimed as
     * a task — so the raw Message id would collide across the two halves of the
     * union and hide the second row. Never use it as a deep-link target; read
     * the target off `ask` or `claim` instead.
     */
    id: string;
    /** The name behind the mark, for an Agent the Server no longer lists. */
    markName: string;
    /** Where it came from, and what kind of row it is. */
    meta: string;
    /** The line that says why, beside the title. */
    preview: string;
    title: string;
}

/**
 * One row in Needs you. The record rides along so the row can be opened: an
 * Ask carries the Message its Thread hangs off, a stalled claim the task.
 */
export type NeedsYouRow =
    | (NeedsYouRowFace & { ask: NeedsYouAsk; kind: 'ask' })
    | (NeedsYouRowFace & { claim: TaskItem; kind: 'claim' });

/**
 * Asks and stalled claims as one list.
 *
 * They were two lists in one card, which meant the seam between them was the
 * only place in the section with no divider — the reader could see the join.
 * One list over a discriminated row settles that: the same row anatomy, the
 * same dividers, and the kind stated in words rather than by a change of
 * shape.
 *
 * Asks lead. An Ask is a decision only this human can make; a stalled claim is
 * work that fell over and will still be there in a minute.
 */
export function toNeedsYouRows(
    asks: readonly NeedsYouAsk[],
    claims: readonly TaskItem[]
): NeedsYouRow[] {
    return [
        ...asks.map(
            (ask): NeedsYouRow => ({
                agentId: ask.agentId,
                ask,
                avatarUrl: null,
                id: `ask:${ask.id}`,
                kind: 'ask',
                markName: ask.agentName,
                meta: `Ask · ${ask.chatLabel}`,
                preview: ask.summary,
                title: ask.title,
            })
        ),
        ...claims.map(
            (claim): NeedsYouRow => ({
                agentId: claim.assigneeAgentId,
                avatarUrl: claim.assigneeAvatarUrl,
                claim,
                id: `claim:${claim.id}`,
                kind: 'claim',
                markName: claim.assigneeLabel,
                meta: `${claim.chatLabel} · Task #${claim.number}`,
                preview: claim.title,
                title: stalledClaimTitle(claim),
            })
        ),
    ];
}

/**
 * The Message a row deep-links to: the Ask's own Message for `?ask=`, the
 * claimed task's Message for `?task=`. Read it here rather than off `row.id`,
 * which is namespaced and belongs to the list, not to the URL.
 */
export function needsYouRowTarget(row: NeedsYouRow): string {
    return row.kind === 'ask' ? row.ask.id : row.claim.id;
}

export function stalledClaimTitle(claim: Pick<TaskItem, 'assigneeLabel'>): string {
    return `${claim.assigneeLabel} stopped before finishing`;
}
