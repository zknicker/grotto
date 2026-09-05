import { expect, test } from 'bun:test';
import type { AgentCliMessage } from './agent-api-schemas.ts';
import { formatDeliveryEnvelope, formatHistoryLine } from './agent-format.ts';

function message(overrides: Partial<AgentCliMessage> = {}): AgentCliMessage {
    return {
        attachments: [],
        author: { id: 'agt_orbit', kind: 'agent', label: 'Orbit', metadata: {} },
        body_kind: 'text',
        chat_id: 'cht_product',
        content: 'The migration is staged. Should I run it?',
        created_at: '2026-09-03T12:00:00.000Z',
        deleted_at: null,
        delivery_id: null,
        id: 'msg_1a2b3c4d5e6f',
        metadata: {},
        nonce: 'ask-1',
        role: 'assistant',
        sender: { description: null, handle: 'orbit', type: 'agent' },
        sequence: 7,
        ...overrides,
    };
}

const openAsk = {
    addressee_handle: 'ada',
    id: 'ask_1a2b3c4d',
    recommended_step: 'Approve the staged migration',
    status: 'open',
    title: 'Run the staged migration?',
} as const;

test('an Ask Message states its lifecycle and addressee on every line it rides', () => {
    const ask = message({ ask: openAsk, body_kind: 'ask' });

    expect(formatHistoryLine(ask)).toEndWith(
        'The migration is staged. Should I run it? [ask status=open to=@ada]'
    );
    expect(formatDeliveryEnvelope('#product', ask)).toEndWith(
        'The migration is staged. Should I run it? [ask status=open to=@ada]'
    );
    expect(
        formatHistoryLine(message({ ask: { ...openAsk, status: 'answered' }, body_kind: 'ask' }))
    ).toEndWith('[ask status=answered to=@ada]');
    // A revoked addressee keeps a Server handle no one can name; the status is
    // still the fact worth carrying.
    expect(
        formatHistoryLine(
            message({ ask: { ...openAsk, addressee_handle: null }, body_kind: 'ask' })
        )
    ).toEndWith('[ask status=open]');
});

test('an ordinary Message carries no Ask suffix, and the suffixes keep their order', () => {
    expect(formatHistoryLine(message())).toEndWith(
        '@orbit: The migration is staged. Should I run it?'
    );
    expect(
        formatHistoryLine(
            message({
                ask: openAsk,
                attachments: [{ filename: 'plan.md', id: 'att_1' }],
                body_kind: 'ask',
                task: {
                    assignee: { handle: 'ada', id: 'usr_ada' },
                    claimed_at: null,
                    created_at: '2026-09-03T12:00:00.000Z',
                    labels: [],
                    number: 3,
                    origin: 'composed',
                    priority: 'none',
                    status: 'in_progress',
                    updated_at: '2026-09-03T12:00:00.000Z',
                },
            })
        )
    ).toEndWith(
        '[1 attachment: plan.md (id:att_1) — use grotto attachment view to download]' +
            ' [task #3 status=in_progress assignee=@ada] [ask status=open to=@ada]'
    );
});

type CloudAgentWorkBody = NonNullable<AgentCliMessage['cloud_agent_work']>;

const latestRun: NonNullable<CloudAgentWorkBody['latest_run']> = {
    branches: [
        {
            branch: 'cloud/fix-flake',
            pull_request_url: 'https://github.com/grotto/grotto/pull/56',
            repository: 'grotto/grotto',
        },
    ],
    error_code: null,
    run_id: 'car_1234567890abcdef',
    status: 'completed',
    summary: 'Opened a pull request.',
};

const cloudAgentWork: CloudAgentWorkBody = {
    activity: null,
    id: 'caw_1234567890abcdef',
    latest_run: latestRun,
    provider: 'cursor',
    provider_url: 'https://cursor.com/agents/bc_one',
    repository: 'grotto/grotto',
    starting_ref: 'main',
    status: 'completed',
    title: 'Fix the flaky delivery test',
};

test('a Cloud Agent work Message names the pull request it opened', () => {
    const work = message({ body_kind: 'cloud-agent-work', cloud_agent_work: cloudAgentWork });

    expect(formatHistoryLine(work)).toEndWith(
        '[cloud-agent-work status=completed title=Fix the flaky delivery test pr=#56]'
    );
    expect(formatDeliveryEnvelope('#product', work)).toEndWith(
        '[cloud-agent-work status=completed title=Fix the flaky delivery test pr=#56]'
    );
});

test('work with no pull request yet reads exactly as it always did', () => {
    expect(
        formatHistoryLine(
            message({
                body_kind: 'cloud-agent-work',
                cloud_agent_work: {
                    ...cloudAgentWork,
                    latest_run: { ...latestRun, branches: [] },
                    status: 'running',
                },
            })
        )
    ).toEndWith('[cloud-agent-work status=running title=Fix the flaky delivery test]');
    expect(
        formatHistoryLine(
            message({
                body_kind: 'cloud-agent-work',
                cloud_agent_work: { ...cloudAgentWork, latest_run: null, status: 'queued' },
            })
        )
    ).toEndWith('[cloud-agent-work status=queued title=Fix the flaky delivery test]');
});
