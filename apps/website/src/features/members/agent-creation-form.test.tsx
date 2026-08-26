import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReportedComputer } from './agent-creation-contract.ts';
import { AgentCreationForm } from './agent-creation-form.tsx';

const reported: ReportedComputer[] = [
    {
        id: 'cmp_cove',
        inventory: {
            runtimes: [
                {
                    id: 'codex',
                    label: 'Codex',
                    models: [{ id: 'gpt-5.6-sol', label: 'Sol' }],
                },
            ],
        },
        label: 'Cove Computer',
    },
];

test('prefills the prepared proposal while exposing editable execution controls', () => {
    const markup = renderToStaticMarkup(
        <AgentCreationForm
            agents={[]}
            error={null}
            initialValues={{
                avatarUrl: '/api/prepared-action-media/pam_1234567890abcdef',
                computerId: 'cmp_cove',
                description: 'Prepared description.',
                displayName: 'Orbit',
            }}
            isPending={false}
            onCreated={() => undefined}
            onSubmit={async () => ({ agentId: 'agt_1234567890abcdef' })}
            reported={reported}
        />
    );

    expect(markup).toContain('value="Orbit"');
    expect(markup).toContain('Prepared description.');
    expect(markup).toContain('Cove Computer');
    expect(markup).toContain('Reasoning effort');
    expect(markup).toContain('aria-label="Change avatar"');
});

test('keeps the form mounted with a recoverable commit error', () => {
    const markup = renderToStaticMarkup(
        <AgentCreationForm
            agents={[]}
            error={{ message: 'The Computer no longer reports this model.' }}
            initialValues={{
                avatarUrl: null,
                description: null,
                displayName: 'Orbit',
            }}
            isPending={false}
            onCreated={() => undefined}
            onSubmit={async () => ({ agentId: 'agt_1234567890abcdef' })}
            reported={reported}
        />
    );

    expect(markup).toContain('The Computer no longer reports this model.');
    expect(markup).toContain('Create Agent');
    expect(markup).toContain('value="Orbit"');
});
