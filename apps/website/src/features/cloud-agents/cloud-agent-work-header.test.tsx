import { expect, test } from 'bun:test';
import type { CloudAgentWork } from '@grotto/api';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloudAgentWorkDetail, CloudAgentWorkHeader } from './cloud-agent-work-header.tsx';

test('the header names the provider and the work, and states its status', () => {
    const html = renderToStaticMarkup(<CloudAgentWorkHeader work={work({})} />);

    expect(html).toContain('Cursor');
    expect(html).toContain('Fix the failing migration');
    expect(html).toContain('Queued');
    // The title is the only part that gives way when the row runs out of room.
    expect(html).toContain('truncate');
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
