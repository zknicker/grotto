import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { runGrottoCommand } from '../src/grotto-operations.ts';

test('keeps operation credentials and credential paths out of actionable errors', async () => {
    const secrets = {
        GROTTO_DATABASE_URL: 'postgres://runtime:database-password@127.0.0.1/grotto',
        GROTTO_HEALTH_SERVER_PING_URL: 'https://health.example/private-token',
        PGPASSWORD: 'database-password',
        RESTIC_PASSWORD_FILE: '/private/restic-password',
        RESTIC_REPOSITORY: 's3:https://access-key@backup.example/bucket',
    };

    try {
        await runGrottoCommand(
            '/bin/sh',
            [
                '-c',
                'printf "%s\\n" "$GROTTO_DATABASE_URL" "$GROTTO_HEALTH_SERVER_PING_URL" "$PGPASSWORD" "$RESTIC_PASSWORD_FILE" "$RESTIC_REPOSITORY" "useful failure" >&2; exit 1',
            ],
            { env: secrets }
        );
        throw new Error('Expected the command to fail.');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).toContain('useful failure');
        for (const secret of Object.values(secrets)) {
            expect(message).not.toContain(secret);
        }
    }
});

test('shell-sourced backup and restore examples preserve credential paths', async () => {
    const configRoot = fileURLToPath(new URL('../config/', import.meta.url));

    for (const name of ['backup.env.example', 'restore.env.example']) {
        const command = Bun.spawn(
            [
                '/bin/sh',
                '-c',
                '. "$1"; test "$RESTIC_PASSWORD_FILE" = "/Library/Application Support/Grotto/Server/restic-password"',
                'sh',
                `${configRoot}${name}`,
            ],
            { stderr: 'pipe' }
        );
        const [exitCode, stderr] = await Promise.all([
            command.exited,
            new Response(command.stderr).text(),
        ]);

        expect(stderr).toBe('');
        expect(exitCode).toBe(0);
    }
});
