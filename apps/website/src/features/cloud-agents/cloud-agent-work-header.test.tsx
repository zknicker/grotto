import { expect, test } from 'bun:test';
import type { CloudAgentWork } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloudAgentWorkDetail, CloudAgentWorkHeader } from './cloud-agent-work-header.tsx';
import { ThreadCloudAgentRows } from './thread-cloud-agent-rows.tsx';

test('the header names the provider and the work, and states its status', () => {
    const html = renderToStaticMarkup(<CloudAgentWorkHeader work={work({})} />);

    expect(html).toContain('Cursor');
    expect(html).toContain('Fix the failing migration');
    expect(html).toContain('Queued');
    // The title is the only part that gives way when the row runs out of room.
    expect(html).toContain('truncate');
});

test('each hoisted row names its work and status without another click target', () => {
    const html = renderToStaticMarkup(
        <ThreadCloudAgentRows
            works={[
                work({
                    startedAt: new Date(Date.now() - 120_000).toISOString(),
                    status: 'running',
                }),
            ]}
        />
    );

    expect(html).toContain('>Running</span>');
    expect(html).not.toContain('Running ·');
    expect(html).toContain('>Cursor</span>');
    expect(html).toContain('height:20px;width:20px');
    expect(html).toContain('Fix the failing migration');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
});

test('thread rows show the current outcome, including a pending cancellation', () => {
    for (const [overrides, label] of [
        [{ status: 'completed' }, 'Done'],
        [{ status: 'failed' }, 'Failed'],
        [{ status: 'running', cancelRequestedAt: new Date().toISOString() }, 'Cancelling'],
    ] satisfies [Partial<CloudAgentWork>, string][]) {
        const html = renderToStaticMarkup(<ThreadCloudAgentRows works={[work(overrides)]} />);
        expect(html).toContain(`>${label}</span>`);
    }
});

test('the detail line carries activity while the work runs', () => {
    const html = renderToStaticMarkup(
        <CloudAgentWorkDetail
            work={work({
                activity: { at: new Date().toISOString(), summary: 'Running the test suite.' },
                status: 'running',
            })}
        />
    );

    expect(html).toContain('Running the test suite.');
});

test('compact completed rows show recorded diff counts, not the task title', () => {
    const completed = work({
        status: 'completed',
        runs: [
            {
                runId: 'car_one',
                status: 'completed',
                providerRunId: null,
                rawStatus: null,
                errorCode: null,
                startedAt: null,
                terminalAt: null,
                summary: null,
                usage: null,
                branches: [
                    {
                        branch: 'cursor/test',
                        repository: 'grotto/grotto',
                        pullRequestUrl: 'https://github.com/grotto/grotto/pull/1',
                        pullRequest: {
                            number: 1,
                            state: 'draft',
                            changedFiles: 1,
                            additions: 10,
                            deletions: 0,
                            observedAt: new Date().toISOString(),
                        },
                    },
                ],
            },
        ],
    });
    const html = renderToStaticMarkup(<ThreadCloudAgentRows works={[completed]} />);
    expect(html).toContain('1 file changed · +10 −0');
    expect(html).not.toContain(completed.title);
    const active = renderToStaticMarkup(
        <ThreadCloudAgentRows works={[{ ...completed, status: 'running' }]} />
    );
    expect(active).toContain(completed.title);
    expect(active).not.toContain('file changed');
    const missing = renderToStaticMarkup(
        <ThreadCloudAgentRows works={[work({ status: 'completed' })]} />
    );
    expect(missing).toContain('>Done</span>');
    expect(missing).not.toContain('changed');
});

test('a work with nothing to report renders no line at all', () => {
    expect(renderToStaticMarkup(<CloudAgentWorkDetail work={work({})} />)).toBe('');
});

test('a running work that has gone quiet says when it last reported', () => {
    const html = renderToStaticMarkup(
        <CloudAgentWorkDetail
            work={work({
                status: 'running',
                updatedAt: new Date(Date.now() - 42 * 60_000).toISOString(),
            })}
        />
    );

    expect(html).toContain('Last update 42m ago');
});

function work(overrides: Partial<CloudAgentWork>): CloudAgentWork {
    const at = new Date().toISOString();

    return {
        activity: null,
        agentId: 'agt_one',
        cancelRequestedAt: null,
        cancelRequestedBy: null,
        chatId: 'cht_one',
        computerId: 'cmp_one',
        createdAt: at,
        id: 'caw_one',
        messageId: 'msg_one',
        provider: 'cursor',
        providerAgentId: null,
        providerUrl: null,
        repository: 'grotto/grotto',
        runs: [],
        startedAt: null,
        startingRef: null,
        status: 'queued',
        terminalAt: null,
        title: 'Fix the failing migration',
        updatedAt: at,
        ...overrides,
    };
}
