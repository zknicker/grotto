import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

describe('eval harness', () => {
    test('headless Clerk does not keep the process alive', async () => {
        const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
        const harnessUrl = new URL('./eval-harness.mjs', import.meta.url).href;
        const websitePackageUrl = pathToFileURL(`${repositoryRoot}apps/website/package.json`).href;
        const script = [
            "import { createRequire } from 'node:module';",
            `import { loadHeadlessClerk } from ${JSON.stringify(harnessUrl)};`,
            `const websiteRequire = createRequire(${JSON.stringify(websitePackageUrl)});`,
            'loadHeadlessClerk(websiteRequire);',
        ].join('\n');

        const result = await runNode(script, 2000);

        expect(result).toEqual({ code: 0, timedOut: false });
    });
});

function runNode(script: string, timeoutMs: number) {
    return new Promise<{ code: number | null; timedOut: boolean }>((resolve, reject) => {
        const child = spawn('node', ['--input-type=module', '--eval', script], {
            stdio: 'ignore',
        });
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGTERM');
        }, timeoutMs);

        child.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        child.once('close', (code) => {
            clearTimeout(timeout);
            resolve({ code, timedOut });
        });
    });
}
