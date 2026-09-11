/**
 * The Inbox's opening line: what day it is, and who is reading. It is the one
 * place the page addresses the person rather than the work, so it stays to a
 * header line and a greeting — no stat tiles, no poster type.
 */
export function todayLabel(now: number): string {
    return new Date(now).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
    });
}

/**
 * Greeting by the reader's own clock. A name is required: a bare "Good
 * morning" addresses nobody, so the caller waits for the member directory
 * rather than greeting a blank.
 */
export function greetingLine(now: number, displayName: string): string {
    return `${dayPart(new Date(now).getHours())}, ${firstName(displayName)}`;
}

function dayPart(hour: number): string {
    if (hour < 12) {
        return 'Good morning';
    }
    return hour < 18 ? 'Good afternoon' : 'Good evening';
}

/** A greeting uses the name a person is called, not their filing name. */
function firstName(displayName: string): string {
    return displayName.trim().split(/\s+/u)[0] ?? displayName;
}
