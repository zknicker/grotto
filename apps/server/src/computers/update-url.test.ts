import { describe, expect, test } from 'bun:test';
import { releaseManifestUrl } from './update.ts';

describe('Computer release selection', () => {
    test('keeps the production pointer when no Grotto release is selected', () => {
        expect(releaseManifestUrl('https://releases.grotto.sh/computer/latest.json')).toBe(
            'https://releases.grotto.sh/computer/latest.json'
        );
    });

    test('binds an update to the immutable Computer release selected by Grotto', () => {
        expect(releaseManifestUrl('https://releases.grotto.sh/computer/latest.json', '1.4.9')).toBe(
            'https://releases.grotto.sh/computer/1.4.9/release.json'
        );
    });
});
