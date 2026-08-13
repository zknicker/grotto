import { describe, expect, test } from 'bun:test';
import {
    nextReminderFireAt,
    parseReminderRepeat,
    parseReminderSnooze,
} from '../src/reminders/cadence.ts';

describe('reminder cadence', () => {
    test('accepts only the reminder grammar', () => {
        expect(parseReminderRepeat('every:15m')).toEqual({
            intervalMs: 900_000,
            kind: 'every',
            spec: 'every:15m',
        });
        expect(parseReminderRepeat('daily@09:00')).toEqual({
            hour: 9,
            kind: 'daily',
            minute: 0,
            spec: 'daily@09:00',
        });
        expect(parseReminderRepeat('weekly:fri,mon,fri@09:30')).toEqual({
            days: [1, 5],
            hour: 9,
            kind: 'weekly',
            minute: 30,
            spec: 'weekly:mon,fri@09:30',
        });

        for (const invalid of [
            'every:0m',
            'every:99999999999d',
            'daily@25:00',
            'weekly:weekday@09:00',
            '0 9 * * *',
            '',
        ]) {
            expect(parseReminderRepeat(invalid), invalid).toBeNull();
        }
        expect(parseReminderSnooze('30m')).toBe(1_800_000);
        expect(parseReminderSnooze('soon')).toBeNull();
    });

    test('keeps wall-clock cadence through DST without double firing', () => {
        const beforeSpringForward = Date.UTC(2026, 2, 8, 4, 30);
        const spring = parseReminderRepeat('daily@02:30');
        expect(spring).not.toBeNull();
        expect(nextReminderFireAt(spring!, beforeSpringForward, 'America/New_York')).toBe(
            Date.UTC(2026, 2, 8, 7, 30)
        );

        const beforeFallBack = Date.UTC(2026, 10, 1, 3, 30);
        const fall = parseReminderRepeat('daily@01:30');
        expect(fall).not.toBeNull();
        const first = nextReminderFireAt(fall!, beforeFallBack, 'America/New_York');
        expect(first).toBe(Date.UTC(2026, 10, 1, 5, 30));
        expect(nextReminderFireAt(fall!, first, 'America/New_York')).toBe(
            Date.UTC(2026, 10, 2, 6, 30)
        );
    });
});
