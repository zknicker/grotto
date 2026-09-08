import { describe, expect, test } from 'bun:test';
import {
    OUTPUT_PATH,
    renderSwiftSource,
    resolveTokens,
} from '../../../../scripts/agent-html-tokens/generate-ios-tokens.ts';
import { agentHtmlTokenNames } from './tokens.ts';

/**
 * The generator lives under `scripts/`, but its test lives here on purpose: it
 * resolves the app's stylesheets, `@heroui-pro/react/dist/css/index.css` among
 * them, and that dist is a licensed download the Quality job deliberately does
 * not fetch. `apps/website/src` is exactly the tree whose tests are heavy for
 * that reason, so `test:app-unit` owns this drift gate rather than `test:fast`.
 */
describe('agent-html iOS token snapshot', () => {
    test('the checked-in Swift table matches a fresh generation', async () => {
        const checkedIn = await Bun.file(OUTPUT_PATH).text();

        expect(checkedIn).toBe(renderSwiftSource());
    });

    test('every published name is resolved for both schemes', () => {
        for (const scheme of ['dark', 'light'] as const) {
            const names = resolveTokens(scheme).map((token) => token.name);

            expect(names).toEqual([...agentHtmlTokenNames, '--chart-grid', '--chart-label']);
        }
    });

    test('no resolved value leaks a var() or calc() reference', () => {
        for (const scheme of ['dark', 'light'] as const) {
            for (const token of resolveTokens(scheme)) {
                expect(token.value).not.toContain('var(');
                expect(token.value).not.toContain('calc(');
            }
        }
    });
});
