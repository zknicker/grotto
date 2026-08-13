import { describe, expect, test } from 'bun:test';
import { resolveGrottoServerOrigin } from './grotto-server.tsx';

describe('Grotto Server origin', () => {
    test('uses the browser origin when production does not configure a separate Server', () => {
        expect(resolveGrottoServerOrigin(undefined, 'https://grotto.sh')).toBe('https://grotto.sh');
    });

    test('keeps the browser origin authoritative over development configuration', () => {
        expect(resolveGrottoServerOrigin('http://127.0.0.1:8090', 'https://grotto.sh')).toBe(
            'https://grotto.sh'
        );
    });

    test('uses explicit development configuration only when development enables it', () => {
        expect(resolveGrottoServerOrigin('http://127.0.0.1:8090', 'file://', true)).toBe(
            'http://127.0.0.1:8090'
        );
    });

    test('rejects the packaged App file origin without an explicit Server origin', () => {
        expect(() => resolveGrottoServerOrigin(undefined, 'file://')).toThrow(
            'configure VITE_GROTTO_SERVER_ORIGIN'
        );
    });
});
