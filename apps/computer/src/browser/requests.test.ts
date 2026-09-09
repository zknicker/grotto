import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDaemonRuntime } from '../daemon-runtime.ts';
import { runBrowserRequest } from './requests.ts';
import { stopBrowserService } from './service.ts';

test('Browser settings stay isolated to one Computer attachment', async () => {
    const runtime = makeDaemonRuntime();
    const root = await mkdtemp(join(tmpdir(), 'grotto-browser-'));
    const first = join(root, 'first');
    const second = join(root, 'second');

    try {
        const saved = await runBrowserRequest(
            first,
            {
                operation: {
                    input: { enabled: false, profileName: 'work' },
                    kind: 'save',
                },
                requestId: 'req_browser000000000',
                type: 'browser-request',
            },
            runtime
        );
        const untouched = await runBrowserRequest(
            second,
            {
                operation: { kind: 'get' },
                requestId: 'req_browser000000001',
                type: 'browser-request',
            },
            runtime
        );

        expect(saved.result?.kind).toBe('settings');
        expect(saved.result?.kind === 'settings' && saved.result.value.profileName).toBe('work');
        expect(saved.result?.kind === 'settings' && saved.result.value.configured).toBe(true);
        expect(untouched.result?.kind).toBe('settings');
        expect(untouched.result?.kind === 'settings' && untouched.result.value.profileName).toBe(
            'default'
        );
        expect(untouched.result?.kind === 'settings' && untouched.result.value.configured).toBe(
            false
        );
    } finally {
        await stopBrowserService();
        await runtime.dispose();
        await rm(root, { force: true, recursive: true });
    }
});
