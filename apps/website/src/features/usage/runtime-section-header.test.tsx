import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { RuntimeSectionHeader } from './runtime-section-header.tsx';

test('moves absent runtimes into quiet header chips', () => {
    const markup = renderToStaticMarkup(
        <RuntimeSectionHeader detectedRuntimeIds={['claude-code', 'grok-build']} />
    );

    expect(markup).toContain('data-slot="item-card-group-header"');
    expect(markup).toContain('data-slot="item-card-group-title"');
    expect(markup).toContain('Runtimes');
    expect(markup).toContain('Not Detected');
    expect(markup).toContain('Codex');
    expect(markup).toContain('Pi');
    expect(markup.match(/chip--soft/g)).toHaveLength(2);
});

test('hides absent-runtime metadata when every runtime is detected', () => {
    const markup = renderToStaticMarkup(
        <RuntimeSectionHeader detectedRuntimeIds={['codex', 'claude-code', 'grok-build', 'pi']} />
    );

    expect(markup).toContain('Runtimes');
    expect(markup).not.toContain('Not Detected');
    expect(markup).not.toContain('chip--soft');
});
