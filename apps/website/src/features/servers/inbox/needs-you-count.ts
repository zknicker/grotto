import { type StalledClaimTask, selectStalledClaims } from './stalled-claims.ts';

/**
 * How many items the Inbox's "Needs you" section would list: every open Ask
 * addressed to this human, plus the claims an Agent left unfinished.
 *
 * It counts through the same selector the section renders, so the sidebar
 * badge and the section can never disagree about what needs you. Asks arrive
 * pre-filtered by Server, so only their number is needed here — the row's names
 * are a rendering concern the count does not pay for. Tasks in review are not
 * counted because the section no longer lists them: a task is the Agent's own
 * ledger, and an Ask is the record that addresses a person.
 */
export function selectNeedsYouCount<TTask extends StalledClaimTask>(input: {
    askCount: number;
    tasks: readonly TTask[];
}): number {
    return input.askCount + selectStalledClaims(input.tasks).length;
}
