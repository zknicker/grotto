import { expect, test } from 'bun:test';
import { type RuntimeUsageRow, staleUsageTimestamp } from './runtime-usage-row.ts';

const row: RuntimeUsageRow = {
    capturedAt: '2026-09-08T14:00:00.000Z',
    fiveHourWindow: null,
    id: 'claude-code',
    status: '',
    title: 'Claude Code',
    window: {
        id: 'current-week-all-models',
        label: 'Weekly Limit',
        resetsAt: '2026-09-10T14:00:00.000Z',
        usedPercent: 22,
    },
};

test('provider capture time determines freshness independently of newer Computer reports', () => {
    expect(staleUsageTimestamp(row, Date.parse('2026-09-08T14:29:00Z'))).toBeNull();
    expect(staleUsageTimestamp(row, Date.parse('2026-09-08T14:30:00Z'))).toBe(row.capturedAt);
});

test('an expired reset is historical even when its snapshot was just captured', () => {
    expect(
        staleUsageTimestamp(
            { ...row, capturedAt: '2026-09-10T14:00:00.000Z' },
            Date.parse('2026-09-10T14:01:00Z')
        )
    ).toBe('2026-09-10T14:00:00.000Z');
});
