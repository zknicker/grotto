import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceChip } from './reference-chip.tsx';

test('renders rich references with the shared HeroUI Chip shell', () => {
    const markup = renderToStaticMarkup(
        <ReferenceChip
            id="agent://agent_blippy"
            kind="agent"
            label="Blippy"
            metadata={{
                agentAvatarUrl: '/blippy.png',
                agentColor: '#7c3aed',
            }}
        />
    );

    expect(markup).toContain('data-slot="chip"');
    expect(markup).toContain('data-slot="chip-label"');
    expect(markup).toContain('chip--sm');
    expect(markup).toContain('align-middle');
    expect(markup).toContain('-translate-y-px');
    expect(markup).toContain('text-sm');
    expect(markup).toContain('--reference-chip-color:#7c3aed');
    expect(markup).toContain('Blippy');
});
