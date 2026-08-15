import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ProviderMark, type ProviderMarkId } from './provider-mark.tsx';

test('renders provider marks as white bare glyphs', () => {
    const providers: ProviderMarkId[] = ['codex', 'claude-code', 'grok-build', 'openrouter', 'pi'];

    for (const provider of providers) {
        const markup = renderToStaticMarkup(<ProviderMark provider={provider} />);

        expect(markup).toMatch(/(?:fill|text)-white/);
        expect(markup).not.toContain('background');
        expect(markup).not.toContain('<img');
    }
});
