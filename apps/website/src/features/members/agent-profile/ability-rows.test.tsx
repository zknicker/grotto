import { expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import type { AgentListOutput, SkillListOutput } from '../../../lib/trpc.tsx';
import { AgentSkillRow } from './ability-rows.tsx';

test('renders an assigned skill with its remove action', () => {
    const agent = { id: 'agent_123', name: 'Tavern' } as AgentListOutput['agents'][number];
    const skill = {
        allowedTools: null,
        dependencyState: 'ready',
        description: 'Read PDF files.',
        diagnostic: null,
        enabled: true,
        id: 'pdf',
        missing: {
            anyBins: [],
            bins: [],
            config: [],
            env: [],
            os: [],
        },
        name: 'PDF',
        readOnly: false,
        surface: 'agent',
        updatedAt: null,
        usability: 'enabled',
        version: null,
    } satisfies SkillListOutput['skills'][number];
    const markup = renderToString(
        <AgentSkillRow agent={agent} isSaving={false} onRemove={() => undefined} skill={skill} />
    );
    expect(markup).toContain('Remove PDF from Tavern');
});
