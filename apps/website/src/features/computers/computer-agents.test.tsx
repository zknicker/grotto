import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComputerAgentGrid } from './computer-agents.tsx';

test('Computer Agents render as a HeroUI Pro data grid', () => {
    const html = renderToStaticMarkup(
        <ComputerAgentGrid
            onOpenAgent={() => undefined}
            rows={[
                {
                    avatarUrl: null,
                    availability: 'idle',
                    displayName: 'Blippy',
                    id: 'agent-blippy',
                    model: 'GPT-5.6 Sol',
                    runtime: 'Codex',
                },
            ]}
        />
    );

    expect(html).toContain('data-slot="data-grid"');
    expect(html).toContain('aria-label="Agents on this Computer"');
    expect(html).toContain('Agent');
    expect(html).toContain('Runtime');
    expect(html).toContain('Model');
    expect(html).toContain('Status');
    expect(html).toContain('Blippy');
    expect(html).toContain('Codex');
    expect(html).toContain('GPT-5.6 Sol');
    expect(html).toContain('Online');
    expect(html).toContain('chip--lg');
});
