import { describe, expect, test } from 'bun:test';
import { isAllowedAppOrigin } from './origin.ts';

describe('isAllowedAppOrigin', () => {
    test('allows packaged Electron file origins', () => {
        expect(isAllowedAppOrigin('file://', 'https://app.grotto.test')).toBe(true);
        expect(
            isAllowedAppOrigin(
                'file:///Applications/Grotto.app/index.html',
                'https://app.grotto.test'
            )
        ).toBe(true);
    });
});
