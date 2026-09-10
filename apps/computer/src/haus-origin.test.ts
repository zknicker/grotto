import { expect, spyOn, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAttachmentStore } from './attachment-store.ts';
import { hausOrigin } from './haus-origin.ts';
import { ensureComputerLoginSession, readComputerLoginSession } from './login.ts';

test('only the former production origin migrates to Haus', () => {
    expect(hausOrigin('https://grotto.sh')).toBe('https://haus.chat');
    for (const origin of [
        'https://haus.chat',
        'http://grotto.sh',
        'https://grotto.sh:8443',
        'https://grotto.sh.example.com',
        'http://localhost:1234',
    ]) {
        expect(hausOrigin(origin)).toBe(origin);
    }
});

test('every attachment lookup uses Haus while preserving stored credentials and rollback state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'haus-attachment-migration-'));
    const directory = join(root, 'servers', 'srv_test');
    const attachment = {
        computerId: 'cmp_test',
        credential: 'unchanged-attachment-credential',
        serverId: 'srv_test',
        serverOrigin: 'https://grotto.sh',
        slug: 'test',
    };
    try {
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'attachment.json'), JSON.stringify(attachment));
        const store = createAttachmentStore(root);
        const expected = { ...attachment, serverOrigin: 'https://haus.chat' };
        expect(await store.readAttachment('srv_test')).toEqual(expected);
        expect(await store.findAttachment('test')).toEqual(expected);
        expect(await store.listAttachments()).toEqual([expected]);
        expect(await store.readAttachment('../outside')).toBeNull();
        expect(JSON.parse(await readFile(join(directory, 'attachment.json'), 'utf8'))).toEqual(
            attachment
        );
    } finally {
        await rm(root, { force: true, recursive: true });
    }
});

test('a legacy login refresh sends credentials only to Haus and stores the canonical origin', async () => {
    const root = await mkdtemp(join(tmpdir(), 'haus-login-migration-'));
    const stored = {
        accessToken: `gcl_at_${'a'.repeat(43)}`,
        accessTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        origin: 'https://grotto.sh',
        refreshToken: `gcl_rt_${'b'.repeat(43)}`,
        refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        sessionId: 'cls_1234567890123456',
    };
    const request = (input: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) => {
        expect(String(input)).toBe('https://haus.chat/computer/login/refresh');
        expect(options?.redirect).toBe('error');
        return Promise.resolve(
            Response.json({
                ...stored,
                accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
                status: 'refreshed',
            })
        );
    };
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
        Object.assign(request, { preconnect: globalThis.fetch.preconnect })
    );
    try {
        await writeFile(join(root, 'login.json'), JSON.stringify(stored));
        const session = await readComputerLoginSession(root);
        expect(session?.origin).toBe('https://haus.chat');
        if (!session) {
            throw new Error('Expected the saved login session.');
        }
        const refreshed = await ensureComputerLoginSession({ dataRoot: root, session });
        expect(refreshed.origin).toBe('https://haus.chat');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(await readFile(join(root, 'login.json'), 'utf8')).origin).toBe(
            'https://haus.chat'
        );
    } finally {
        fetchSpy.mockRestore();
        await rm(root, { force: true, recursive: true });
    }
});
