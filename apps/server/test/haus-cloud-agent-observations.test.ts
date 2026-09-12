import { expect, test } from 'bun:test';
import type { CloudAgentWork } from '@haus/api';
import { cloudAgentFixture } from './cloud-agent-fixture.ts';

const fixture = cloudAgentFixture();

test('observations apply idempotently and a settled Run creates one inbox attention', async () => {
    const runner = await fixture.mintRunner('run_cloud_observe');
    const created = await fixture.postStart(runner, fixture.startBody({ nonce: 'cloud-observe' }));
    const work = created.body.work as CloudAgentWork;
    const runId = created.body.runId as string;

    const socket = await fixture.attachComputer();
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T12:00:00.000Z',
                providerAgentId: 'bc_one',
                providerUrl: 'https://cursor.com/agents/bc_one',
                runId,
                status: 'running',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await fixture.waitForWorkStatus(work.id, 'running');
    expect(await fixture.readWork(work.id)).toMatchObject({
        provider_agent_id: 'bc_one',
        provider_url: 'https://cursor.com/agents/bc_one',
        terminal_at: null,
    });

    // A stale observation is a no-op.
    socket.send(
        JSON.stringify({
            observation: {
                activity: { at: '2026-09-04T11:00:00.000Z', summary: 'Older news.' },
                observedAt: '2026-09-04T11:59:00.000Z',
                runId,
                status: 'queued',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await Bun.sleep(150);
    expect(await fixture.readWork(work.id)).toMatchObject({
        activity_summary: null,
        status: 'running',
    });

    // The Computer's own GitHub reading of the pull request the Run opened.
    socket.send(
        JSON.stringify({
            observation: {
                branches: [
                    {
                        branch: 'cloud/fix-flake',
                        pullRequest: {
                            additions: 34,
                            changedFiles: 1,
                            deletions: 0,
                            number: 12,
                            observedAt: '2026-09-04T12:04:00.000Z',
                            state: 'draft',
                        },
                        pullRequestUrl: 'https://github.com/haus/haus/pull/12',
                        repository: 'haus/haus',
                    },
                ],
                observedAt: '2026-09-04T12:04:00.000Z',
                runId,
                status: 'running',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await fixture.waitFor(async () => (await fixture.readBranches(runId))[0]?.pullRequest);

    socket.send(
        JSON.stringify({
            observation: {
                branches: [
                    {
                        branch: 'cloud/fix-flake',
                        pullRequestUrl: 'https://github.com/haus/haus/pull/12',
                        repository: 'haus/haus',
                    },
                ],
                observedAt: '2026-09-04T12:05:00.000Z',
                rawStatus: 'FINISHED',
                runId,
                status: 'completed',
                summary: 'Opened a pull request.',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await fixture.waitForWorkStatus(work.id, 'completed');
    expect(await fixture.readRun(runId)).toMatchObject({
        raw_status: 'FINISHED',
        status: 'completed',
        summary: 'Opened a pull request.',
    });
    // A terminal report that could not read GitHub keeps the snapshot already recorded.
    expect(await fixture.readBranches(runId)).toEqual([
        {
            branch: 'cloud/fix-flake',
            pullRequest: {
                additions: 34,
                changedFiles: 1,
                deletions: 0,
                number: 12,
                observedAt: '2026-09-04T12:04:00.000Z',
                state: 'draft',
            },
            pullRequestUrl: 'https://github.com/haus/haus/pull/12',
            repository: 'haus/haus',
        },
    ]);
    expect(await fixture.readAttentions(runId)).toHaveLength(1);

    // A later terminal report changes nothing and adds no second attention.
    socket.send(
        JSON.stringify({
            observation: {
                observedAt: '2026-09-04T12:09:00.000Z',
                runId,
                status: 'failed',
                summary: 'Late duplicate.',
                workId: work.id,
            },
            type: 'cloud-agent-observation',
        })
    );
    await Bun.sleep(150);
    expect(await fixture.readWork(work.id)).toMatchObject({ status: 'completed' });
    expect(await fixture.readAttentions(runId)).toHaveLength(1);
    socket.close();
});
