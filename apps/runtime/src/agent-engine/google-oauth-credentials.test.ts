import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const googleClientIdEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_ID';
const googleClientSecretEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_SECRET';
const runtimeAssetsDirEnv = 'TAVERN_RUNTIME_ASSETS_DIR';
const execFileAsync = promisify(execFile);

describe('Google OAuth credentials', () => {
    const originalClientId = process.env[googleClientIdEnv];
    const originalClientSecret = process.env[googleClientSecretEnv];
    const originalRuntimeAssetsDir = process.env[runtimeAssetsDirEnv];
    const originalCwd = process.cwd();
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(path.join(os.tmpdir(), 'tavern-google-oauth-'));
        process.chdir(tempDir);
        restoreEnv(googleClientIdEnv, undefined);
        restoreEnv(googleClientSecretEnv, undefined);
        restoreEnv(runtimeAssetsDirEnv, undefined);
    });

    afterEach(async () => {
        process.chdir(originalCwd);
        restoreEnv(googleClientIdEnv, originalClientId);
        restoreEnv(googleClientSecretEnv, originalClientSecret);
        restoreEnv(runtimeAssetsDirEnv, originalRuntimeAssetsDir);
        await rm(tempDir, { force: true, recursive: true });
    });

    it('reads credentials from process env', async () => {
        process.env[googleClientIdEnv] = 'env-client-id';
        process.env[googleClientSecretEnv] = 'env-client-secret';

        const { getRequiredGoogleOAuthCredentials } = await import('./google-oauth-credentials.ts');

        expect(getRequiredGoogleOAuthCredentials()).toEqual({
            clientId: 'env-client-id',
            clientSecret: 'env-client-secret',
        });
    });

    it('reads credentials from the checkout .env file', async () => {
        await writeFile(
            path.join(tempDir, '.env'),
            `${googleClientIdEnv}=file-client-id\n${googleClientSecretEnv}=file-client-secret\n`
        );

        const env = { ...process.env };
        delete env[googleClientIdEnv];
        delete env[googleClientSecretEnv];
        delete env[runtimeAssetsDirEnv];
        const moduleUrl = pathToFileURL(
            path.join(import.meta.dirname, 'google-oauth-credentials.ts')
        ).href;
        const { stdout } = await execFileAsync(
            process.execPath,
            [
                '-e',
                [
                    `import { getRequiredGoogleOAuthCredentials } from ${JSON.stringify(moduleUrl)};`,
                    'console.log(JSON.stringify(getRequiredGoogleOAuthCredentials()));',
                ].join('\n'),
            ],
            { cwd: tempDir, env }
        );

        expect(JSON.parse(stdout)).toEqual({
            clientId: 'file-client-id',
            clientSecret: 'file-client-secret',
        });
    });

    it('falls back to the packaged Runtime asset', async () => {
        const assetsDir = path.join(tempDir, 'runtime-assets');
        const googleAssetsDir = path.join(assetsDir, 'google');
        await mkdir(googleAssetsDir, { recursive: true });
        await writeFile(
            path.join(googleAssetsDir, 'oauth-client.json'),
            `${JSON.stringify({
                clientId: 'asset-client-id',
                clientSecret: 'asset-client-secret',
            })}\n`
        );
        process.env[googleClientIdEnv] = '';
        process.env[googleClientSecretEnv] = '';
        process.env[runtimeAssetsDirEnv] = assetsDir;

        const { getRequiredGoogleOAuthCredentials } = await import('./google-oauth-credentials.ts');

        expect(getRequiredGoogleOAuthCredentials()).toEqual({
            clientId: 'asset-client-id',
            clientSecret: 'asset-client-secret',
        });
    });
});

function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = value;
    }
}
