import { describe, expect, test } from 'bun:test';
import { agentTurnDays, agentTurnWindowDays } from './agent-turn-days.ts';

/**
 * The window is the reader's calendar days, so the fixtures are local instants
 * — a UTC literal would land on either side of midnight depending on where the
 * suite runs.
 */
function localTime(day: number, hour: number) {
    return new Date(2025, 4, day, hour, 0, 0, 0);
}

const now = localTime(8, 15).getTime();

function turnStartedAt(day: number, hour: number) {
    return { startedAt: localTime(day, hour).toISOString() };
}

describe('agentTurnDays', () => {
    test('the window is seven days and ends on today', () => {
        const days = agentTurnDays([turnStartedAt(8, 9)], now);
        expect(days).toHaveLength(agentTurnWindowDays);
        expect(days.at(-1)).toBe(1);
    });

    test('turns land in the calendar day they started', () => {
        const turns = [turnStartedAt(8, 9), turnStartedAt(8, 14), turnStartedAt(6, 20)];
        expect(agentTurnDays(turns, now)).toEqual([0, 0, 0, 0, 1, 0, 2]);
    });

    test('turns outside the window are dropped, not clamped into the first day', () => {
        expect(agentTurnDays([turnStartedAt(1, 9)], now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    test('an unsettled turn read is a flat window rather than a gap', () => {
        expect(agentTurnDays(undefined, now)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    test('an unparseable timestamp is skipped', () => {
        const turns = [{ startedAt: 'not-a-date' }, turnStartedAt(8, 9)];
        expect(agentTurnDays(turns, now)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    });
});
