import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Loading the bundle is open-ended work: a cold Node start plus roughly a
// megabyte of Clerk, which takes ~70ms on a warm developer machine and far
// longer on a cold, contended CI box. That has nothing to do with what is being
// asserted, so it gets its own generous budget. The claim under test lives in
// the window *after* the load: a process with nothing left to do must exit by
// itself, which takes single-digit milliseconds or never happens at all.
const LOAD_BUDGET_MS = 60_000;
const EXIT_BUDGET_MS = 15_000;
const LOADED_MARKER = 'loaded ';

describe('eval harness', () => {
    test(
        'headless Clerk does not keep the process alive',
        async () => {
            const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
            const seamUrl = new URL('./headless-clerk.mjs', import.meta.url).href;
            const websitePackageUrl = pathToFileURL(
                `${repositoryRoot}apps/website/package.json`
            ).href;
            const script = [
                "import { createRequire } from 'node:module';",
                `import { loadHeadlessClerk } from ${JSON.stringify(seamUrl)};`,
                `const websiteRequire = createRequire(${JSON.stringify(websitePackageUrl)});`,
                'loadHeadlessClerk(websiteRequire);',
                // Announce that the work is finished and name whatever still holds
                // the loop, then stop: from here Node either exits on its own or it
                // does not, and nothing this script does can change which.
                `process.stdout.write(${JSON.stringify(LOADED_MARKER)} + JSON.stringify(process.getActiveResourcesInfo()) + '\\n');`,
            ].join('\n');

            const result = await loadClerkAndWaitForExit(script);

            expect(result).toEqual({ code: 0, exit: 'on its own' });
        },
        LOAD_BUDGET_MS + EXIT_BUDGET_MS + 5000
    );
});

/**
 * Runs `script` under Node and reports how the process ended: `on its own` once
 * Node runs out of work, otherwise a description of what stopped it from doing
 * so, which is what the assertion prints when it fails.
 */
function loadClerkAndWaitForExit(script: string) {
    return new Promise<{ code: number | null; exit: string }>((resolve, reject) => {
        const child = spawn('node', ['--input-type=module', '--eval', script], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        let exitBudget: ReturnType<typeof setTimeout> | undefined;
        let failure = '';

        const loadBudget = setTimeout(() => {
            failure = `never finished loading Clerk within ${LOAD_BUDGET_MS}ms`;
            child.kill('SIGKILL');
        }, LOAD_BUDGET_MS);

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
            const marker = stdout.indexOf(LOADED_MARKER);
            const lineEnd = stdout.indexOf('\n', marker);
            if (exitBudget || marker === -1 || lineEnd === -1) {
                return;
            }
            // Clerk is loaded, so the only thing left worth waiting on is the
            // exit itself.
            clearTimeout(loadBudget);
            const held = stdout.slice(marker + LOADED_MARKER.length, lineEnd);
            exitBudget = setTimeout(() => {
                failure = `did not exit within ${EXIT_BUDGET_MS}ms of loading; active handles were ${held}`;
                child.kill('SIGKILL');
            }, EXIT_BUDGET_MS);
        });
        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.once('error', (error) => {
            clearTimeout(loadBudget);
            clearTimeout(exitBudget);
            reject(error);
        });
        child.once('close', (code) => {
            clearTimeout(loadBudget);
            clearTimeout(exitBudget);
            resolve({
                code,
                exit:
                    failure ||
                    (exitBudget ? 'on its own' : `died loading Clerk: ${summarize(stderr)}`),
            });
        });
    });
}

/** Picks the line a reader needs out of a Node stack trace: the thrown error. */
function summarize(stderr: string) {
    const lines = stderr
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    return lines.find((line) => /^\w*Error\b/u.test(line)) ?? lines[0] ?? 'no output';
}
