import { describe, expect, test } from 'bun:test';
import { computerEntrypoint, computerRunnerEntrypoint } from './build-identity.ts';

describe('computerRunnerEntrypoint', () => {
    test('watches the attachment runner in development', () => {
        const entrypoint = computerEntrypoint();

        expect(computerRunnerEntrypoint('srv_dev', { watch: true })).toEqual({
            args: ['--watch', ...entrypoint.args, 'run', 'srv_dev'],
            executable: entrypoint.executable,
        });
    });

    test('keeps production attachment runners stable', () => {
        const entrypoint = computerEntrypoint();

        expect(computerRunnerEntrypoint('srv_prod', { watch: false })).toEqual({
            args: [...entrypoint.args, 'run', 'srv_prod'],
            executable: entrypoint.executable,
        });
    });
});
