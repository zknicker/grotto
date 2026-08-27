import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReferenceChip } from './reference-chip.tsx';

test('renders rich references with the shared HeroUI Chip shell', () => {
    const markup = renderToStaticMarkup(
        <ReferenceChip
            id="agent://agent_blippy"
            kind="agent"
            label="blippy"
            metadata={{
                agentAvatarUrl: '/blippy.png',
                agentColor: '#7c3aed',
                agentDisplayName: 'Blippy',
            }}
        />
    );

    expect(markup).toContain('data-slot="chip"');
    expect(markup).toContain('data-slot="chip-label"');
    expect(markup).toContain('chip--md');
    expect(markup).toContain('chip--tertiary');
    expect(markup).toContain('chip--accent');
    expect(markup).toContain('reference-chip');
    expect(markup).toContain('reference-chip__mark');
    expect(markup).toContain('align-middle');
    expect(markup).not.toContain('translate-y');
    expect(markup).not.toContain('text-sm');
    expect(markup).toContain('font-semibold');
    expect(markup).toContain('height:18px');
    expect(markup).toContain('width:18px');
    expect(markup).not.toContain('--chip-bg');
    expect(markup).not.toContain('--reference-chip-color');
    expect(markup).toContain('Blippy');
    expect(markup).not.toContain('<button');
});

test('renders activated references with native button semantics', () => {
    const markup = renderToStaticMarkup(
        <ReferenceChip
            id="chat://cht_product"
            kind="chat"
            label="#product"
            onActivate={() => undefined}
        />
    );

    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('align-middle');
    expect(markup).toContain('data-slot="chip"');
    expect(markup).toContain('data-slot="chip-label"');
    expect(markup).toContain('#product');
});

test('renders chat references with the shared colored Channel identity mark', () => {
    const markup = renderToStaticMarkup(
        <ReferenceChip
            id="chat://cht_product"
            kind="chat"
            label="product"
            metadata={{ chatColor: 'violet', chatIcon: 'RocketIcon' }}
        />
    );
    const chipOpenTag = markup.slice(
        markup.lastIndexOf('<span', markup.indexOf('data-slot="chip"')),
        markup.indexOf('>', markup.indexOf('data-slot="chip"'))
    );

    expect(markup).toContain('height:18px');
    expect(markup).toContain('width:18px');
    expect(markup).toContain('--channel-color-light:#7c3aed');
    expect(markup).toContain('bg-[var(--channel-color-bg-light,var(--default))]');
    expect(markup).toContain('reference-chip--channel');
    expect(markup).toContain('reference-chip__mark');
    expect(markup).toContain('chip--tertiary');
    expect(markup).toContain('chip--default');
    expect(markup).not.toContain('chip--success');
    expect(chipOpenTag).toContain('--channel-color-light:#7c3aed');
    expect(markup).toContain('font-semibold');
    expect(markup).not.toContain('--chip-bg');
    expect(markup).not.toContain('--reference-chip-color');
});

test('keeps non-navigable references inert even when activation is provided', () => {
    const markup = renderToStaticMarkup(
        <ReferenceChip
            id="skill://design"
            kind="skill"
            label="design"
            onActivate={() => undefined}
        />
    );

    expect(markup).not.toContain('<button');
    expect(markup).toContain('data-slot="chip"');
    expect(markup).toContain('chip--tertiary');
    expect(markup).toContain('chip--warning');
    expect(markup).toContain('size-[18px]');
    expect(markup).toContain('font-semibold');
    expect(markup).not.toContain('--chip-bg');
    expect(markup).toContain('Design');
});
