import { expect, test } from 'bun:test';
import type { CloudAgentRun, CloudAgentStatus, CloudAgentWork } from '@grotto/api';
import {
    canCancelCloudAgentWork,
    cloudAgentPresentationStatus,
    cloudAgentRunReportLine,
    cloudAgentStatusText,
    cloudAgentStatusTone,
    cloudAgentWorkDetailLine,
    formatCloudAgentDuration,
    isCloudAgentWorkStale,
} from './cloud-agent-presentation.ts';

const startedAt = '2026-09-04T12:00:00.000Z';
const now = Date.parse('2026-09-04T12:04:00.000Z');

test('a queued work states only that it is queued', () => {
    expect(cloudAgentStatusText(work({ startedAt: null, status: 'queued' }), now)).toBe('Queued');
});

test('a running work counts up from the moment the provider started it', () => {
    expect(cloudAgentStatusText(work({ status: 'running' }), now)).toBe('Running · 4m');
});

test('a running work with no provider start time still reads as running', () => {
    expect(cloudAgentStatusText(work({ startedAt: null, status: 'running' }), now)).toBe('Running');
});

test('a completed work states how long it took, not how long ago it was', () => {
    const completed = work({
        status: 'completed',
        terminalAt: '2026-09-04T13:12:00.000Z',
    });

    expect(cloudAgentStatusText(completed, now)).toBe('Done · 1h 12m');
});

test('a failed, expired, or cancelled work names only its outcome', () => {
    expect(cloudAgentStatusText(work({ status: 'failed' }), now)).toBe('Failed');
    expect(cloudAgentStatusText(work({ status: 'expired' }), now)).toBe('Expired');
    expect(cloudAgentStatusText(work({ status: 'cancelled' }), now)).toBe('Cancelled');
});

test('a cancel recorded against a live Run reads as cancelling until it settles', () => {
    const cancelling = work({ cancelRequestedAt: startedAt, status: 'running' });
    const settled = work({ cancelRequestedAt: startedAt, status: 'cancelled' });

    expect(cloudAgentPresentationStatus(cancelling)).toBe('cancelling');
    expect(cloudAgentStatusText(cancelling, now)).toBe('Cancelling');
    expect(cloudAgentPresentationStatus(settled)).toBe('cancelled');
});

test('only a live or completed work carries a colour beyond muted', () => {
    expect(cloudAgentStatusTone('running')).toBe('accent');
    expect(cloudAgentStatusTone('completed')).toBe('success');
    expect(cloudAgentStatusTone('failed')).toBe('danger');
    expect(cloudAgentStatusTone('expired')).toBe('danger');
    expect(cloudAgentStatusTone('queued')).toBe('muted');
    expect(cloudAgentStatusTone('cancelled')).toBe('muted');
    expect(cloudAgentStatusTone('cancelling')).toBe('muted');
});

test('activity carries the line while the work runs and yields once it settles', () => {
    const activity = { at: startedAt, summary: 'Reading the failing test.' };

    expect(cloudAgentWorkDetailLine(work({ activity, status: 'running' }))).toBe(
        'Reading the failing test.'
    );
    expect(
        cloudAgentWorkDetailLine(
            work({
                activity,
                runs: [run({ summary: 'Opened a pull request.' })],
                status: 'completed',
            })
        )
    ).toBe('Opened a pull request.');
});

test('a terminal work with no summary falls back to the Run error it reported', () => {
    expect(
        cloudAgentWorkDetailLine(
            work({ runs: [run({ errorCode: 'provider_timeout' })], status: 'failed' })
        )
    ).toBe('provider_timeout');
    expect(cloudAgentWorkDetailLine(work({ runs: [], status: 'failed' }))).toBeNull();
});

test('a Markdown Run summary collapses to one flat line', () => {
    const reported = work({
        runs: [
            run({
                summary:
                    '## Summary\nI **fixed** the stale wording in the `README`.\n\n- Ran the tests',
            }),
        ],
        status: 'completed',
    });

    expect(cloudAgentWorkDetailLine(reported)).toBe(
        'Summary I fixed the stale wording in the README. Ran the tests'
    );
});

test('a Markdown activity summary collapses the same way while the work runs', () => {
    const live = work({
        activity: { at: startedAt, summary: '### Now\nReading `migrations/003.sql`' },
        status: 'running',
    });

    expect(cloudAgentWorkDetailLine(live)).toBe('Now Reading migrations/003.sql');
});

test('a Run whose summary is only Markdown scaffolding falls back to its error', () => {
    expect(cloudAgentRunReportLine(run({ errorCode: 'provider_timeout', summary: '##  ' }))).toBe(
        'provider_timeout'
    );
    expect(cloudAgentRunReportLine(run({ summary: '# Done' }))).toBe('Done');
});

test('a running work that has not reported for ten minutes reads as stale', () => {
    const quiet = work({ status: 'running', updatedAt: '2026-09-04T11:50:00.000Z' });

    expect(isCloudAgentWorkStale(quiet, now)).toBe(true);
    expect(isCloudAgentWorkStale({ ...quiet, updatedAt: '2026-09-04T12:03:00.000Z' }, now)).toBe(
        false
    );
    // A settled work is not quiet; it is finished.
    expect(isCloudAgentWorkStale({ ...quiet, status: 'completed' }, now)).toBe(false);
});

test('only an Owner or Admin may cancel, and only a live, uncancelled Run', () => {
    const live = { cancelRequestedAt: null, status: 'running' as CloudAgentStatus };

    expect(canCancelCloudAgentWork({ ...live, role: 'owner' })).toBe(true);
    expect(canCancelCloudAgentWork({ ...live, role: 'admin' })).toBe(true);
    expect(canCancelCloudAgentWork({ ...live, role: 'member' })).toBe(false);
    expect(canCancelCloudAgentWork({ ...live, role: 'owner', status: 'completed' })).toBe(false);
    expect(canCancelCloudAgentWork({ ...live, cancelRequestedAt: startedAt, role: 'owner' })).toBe(
        false
    );
});

test('durations read coarsely, in the units a work surface states', () => {
    expect(formatCloudAgentDuration(-5)).toBe('0s');
    expect(formatCloudAgentDuration(42_000)).toBe('42s');
    expect(formatCloudAgentDuration(11 * 60_000)).toBe('11m');
    expect(formatCloudAgentDuration(60 * 60_000)).toBe('1h');
    expect(formatCloudAgentDuration(150 * 60_000)).toBe('2h 30m');
});

function work(overrides: Partial<CloudAgentWork>): CloudAgentWork {
    return {
        activity: null,
        agentId: 'agt_one',
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        chatId: 'cht_one',
        computerId: 'cmp_one',
        createdAt: startedAt,
        id: 'caw_one',
        messageId: 'msg_one',
        provider: 'cursor',
        providerAgentId: null,
        providerUrl: null,
        repository: 'grotto/grotto',
        runs: [],
        startedAt,
        startingRef: null,
        status: 'running',
        terminalAt: null,
        title: 'Fix the failing migration',
        updatedAt: startedAt,
        ...overrides,
    };
}

function run(overrides: Partial<CloudAgentRun>): CloudAgentRun {
    return {
        branches: [],
        errorCode: null,
        providerRunId: null,
        rawStatus: null,
        runId: 'car_one',
        startedAt,
        status: 'completed',
        summary: null,
        terminalAt: null,
        usage: null,
        ...overrides,
    };
}
