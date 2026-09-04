import type { AskStatus } from '@grotto/api';

/** The word an Ask marker leads with, shared by Chat and the Inbox. */
export const askMarkerLabel = 'Ask';

/**
 * The trailing status one Ask reads as. An open Ask states only that it is
 * open — the addressee beside it already says whose turn it is. A settled Ask
 * names who answered, because the first answer wins permanently and that
 * author is the fact a reader scanning back needs.
 */
export function askStatusText({
    answeredByName,
    status,
}: {
    answeredByName: null | string;
    status: AskStatus;
}): string {
    return status === 'open' ? 'Open' : `Answered by ${answeredByName ?? 'Unknown'}`;
}
