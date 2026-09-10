import { type NeedsYouTask, selectNeedsYouTasks } from './needs-you-tasks.ts';
import { type StalledClaimTask, selectStalledClaims } from './stalled-claims.ts';

/**
 * How many items the Inbox's "Needs you" section would list: every open Ask
 * addressed to this human, plus the claims an Agent left unfinished, plus the
 * Tasks waiting on their review.
 *
 * It counts through the same selectors the section renders, so the sidebar
 * badge and the section can never disagree about what needs you. Asks arrive
 * pre-filtered by Server, so only their number is needed here — the row's names
 * are a rendering concern the count does not pay for. A Task can answer at most
 * one of the two Task questions: a stalled claim is `in_progress` and a review
 * Task is `in_review`, so nothing is counted twice.
 */
export function selectNeedsYouCount<TTask extends NeedsYouTask & StalledClaimTask>(input: {
    askCount: number;
    tasks: readonly TTask[];
    viewerUserId: null | string;
}): number {
    return (
        input.askCount +
        selectStalledClaims(input.tasks).length +
        selectNeedsYouTasks(input.tasks, input.viewerUserId).length
    );
}
