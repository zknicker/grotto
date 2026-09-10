import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivationShell } from './activation-shell.tsx';

describe('ActivationShell', () => {
    test('leads with the vector Grotto ghost as its default mark', () => {
        const markup = renderToStaticMarkup(<ActivationShell>step</ActivationShell>);

        expect(markup).toContain(
            'grotto-ghost grotto-ghost--iridescent grotto-ghost--animated activation-mark'
        );
        expect(markup).not.toContain('grotto-app-icon.png');
    });

    test('a caller can replace the mark', () => {
        const markup = renderToStaticMarkup(<ActivationShell mark={null}>step</ActivationShell>);

        expect(markup).not.toContain('grotto-ghost');
    });
});
