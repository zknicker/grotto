import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivationShell } from './activation-shell.tsx';

describe('ActivationShell', () => {
    test('leads with the vector Haus ghost as its default mark', () => {
        const markup = renderToStaticMarkup(<ActivationShell>step</ActivationShell>);

        expect(markup).toContain(
            'haus-ghost haus-ghost--iridescent haus-ghost--animated activation-mark'
        );
        expect(markup).not.toContain('haus-app-icon.png');
    });

    test('a caller can replace the mark', () => {
        const markup = renderToStaticMarkup(<ActivationShell mark={null}>step</ActivationShell>);

        expect(markup).not.toContain('haus-ghost');
    });
});
