import type { AgentTurn } from '@grotto/api';

/** How much history a roster pill's sparkline covers, in whole days. */
export const agentTurnWindowDays = 7;

const dayMs = 24 * 60 * 60 * 1000;

/**
 * How many turns an Agent ran on each of the last seven days, oldest first.
 *
 * The buckets are the reader's own calendar days rather than UTC days or
 * 24-hour slices counted back from now: the sparkline sits directly under a
 * header that already names today, so its last column has to mean that same
 * day. A turn counts on the day it started, so an overnight run belongs to the
 * day the person set it going.
 *
 * An unsettled turn read yields a window of zeroes, which the sparkline draws
 * as its quiet baseline — the same shape a genuinely idle Agent gets, and the
 * one claim that is safe to make before the data lands.
 */
export function agentTurnDays(
    turns: readonly Pick<AgentTurn, 'startedAt'>[] | undefined,
    now: number,
    days: number = agentTurnWindowDays
): number[] {
    const counts = new Array<number>(days).fill(0);
    const today = startOfLocalDay(now);

    for (const turn of turns ?? []) {
        const started = Date.parse(turn.startedAt);
        if (Number.isNaN(started)) {
            continue;
        }
        const index = days - 1 - daysBefore(startOfLocalDay(started), today);
        if (index >= 0 && index < days) {
            counts[index] = (counts[index] ?? 0) + 1;
        }
    }

    return counts;
}

function startOfLocalDay(time: number): number {
    const date = new Date(time);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

/**
 * Whole calendar days between two local midnights. A day is 23 or 25 hours
 * long across a daylight-saving boundary, so the span is rounded rather than
 * floored — an hour cannot move a turn into the neighbouring column.
 */
function daysBefore(day: number, today: number): number {
    return Math.round((today - day) / dayMs);
}
