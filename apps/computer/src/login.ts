import { randomBytes } from 'node:crypto';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installEnterToOpenUrl, openUrlInBrowser } from './browser-handoff.ts';

const loginSessionFilename = 'login.json';

interface ComputerLoginBeginResponse {
    deviceCode: string;
    expiresAt: string;
    pollingIntervalMs: number;
    userCode: string;
    verificationUrl: string;
}

interface ComputerLoginPendingResponse {
    pollingIntervalMs: number;
    status: 'pending';
}

export interface ComputerLoginSession {
    accessToken: string;
    accessTokenExpiresAt: string;
    origin: string;
    refreshToken: string;
    refreshTokenExpiresAt: string;
    sessionId: string;
}

interface ComputerLoginApprovedResponse extends ComputerLoginSession {
    status: 'approved';
}

interface ComputerLoginCompletedResponse {
    status: 'completed';
}

type ComputerLoginPollResponse = ComputerLoginApprovedResponse | ComputerLoginPendingResponse;

export async function runComputerLogin(options: {
    dataRoot: string;
    serverOrigin: string;
}): Promise<void> {
    const origin = normalizeHttpOrigin(options.serverOrigin);
    const started = await postJson<ComputerLoginBeginResponse>(origin, '/computer/login', {
        origin,
    });
    assertBeginResponse(started);

    const browserOpenEnabled = process.env.GROTTO_COMPUTER_DISABLE_BROWSER_OPEN !== '1';
    const enterOpensBrowser = browserOpenEnabled && process.stdin.isTTY === true;
    let browserOpenRequested = false;
    if (browserOpenEnabled) {
        try {
            openUrlInBrowser(started.verificationUrl);
            browserOpenRequested = true;
        } catch {
            // The printed URL and code remain the manual fallback.
        }
    }

    console.log('Sign in Grotto Computer:');
    console.log(`Verification URL: ${started.verificationUrl}`);
    console.log(`User code: ${started.userCode}`);
    console.log(
        browserOpenRequested
            ? enterOpensBrowser
                ? "Opened automatically. If it didn't open, press Enter to try again."
                : "Opened automatically. If it didn't open, use the URL above."
            : enterOpensBrowser
              ? 'Press Enter to open the URL, or open it manually.'
              : 'Open the URL above and enter the code if needed.'
    );

    const cleanupEnterToOpen = enterOpensBrowser
        ? installEnterToOpenUrl({ input: process.stdin, url: started.verificationUrl })
        : () => {};
    try {
        for (;;) {
            const result = await postJson<ComputerLoginPollResponse>(
                origin,
                '/computer/login/poll',
                {
                    deviceCode: started.deviceCode,
                }
            );
            assertPollResponse(result);
            if (result.status === 'approved') {
                assertOriginBoundSession(result, origin);
                const { status: _status, ...session } = result;
                await writeComputerLoginSession(options.dataRoot, session);
                const completed = await postJson<ComputerLoginCompletedResponse>(
                    origin,
                    '/computer/login/complete',
                    { accessToken: session.accessToken }
                );
                if (completed.status !== 'completed') {
                    throw new Error('Server returned an invalid Computer login completion.');
                }
                console.log('Grotto Computer signed in.');
                return;
            }
            await Bun.sleep(result.pollingIntervalMs);
        }
    } finally {
        cleanupEnterToOpen();
    }
}

export async function writeComputerLoginSession(
    dataRoot: string,
    session: ComputerLoginSession
): Promise<string> {
    await mkdir(dataRoot, { mode: 0o700, recursive: true });
    await chmod(dataRoot, 0o700);
    const destination = join(dataRoot, loginSessionFilename);
    const temporary = `${destination}.${randomBytes(8).toString('hex')}.tmp`;
    try {
        await writeFile(temporary, `${JSON.stringify(session)}\n`, { mode: 0o600 });
        await chmod(temporary, 0o600);
        await rename(temporary, destination);
    } finally {
        await rm(temporary, { force: true });
    }
    return destination;
}

class ComputerLoginRequestError extends Error {
    constructor(
        message: string,
        readonly code: string | undefined,
        readonly status: number
    ) {
        super(message);
        this.name = 'ComputerLoginRequestError';
    }
}

async function postJson<Response>(origin: string, path: string, body: object): Promise<Response> {
    const response = await fetch(new URL(path, origin), {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    const payload = (await response.json()) as Response & { code?: string; error?: string };
    if (!response.ok) {
        throw new ComputerLoginRequestError(
            payload.error ?? 'Computer login was rejected.',
            payload.code,
            response.status
        );
    }
    return payload;
}

function normalizeHttpOrigin(value: string): string {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Grotto Server origin must use HTTP(S).');
    }
    return url.origin;
}

function assertBeginResponse(
    value: ComputerLoginBeginResponse
): asserts value is ComputerLoginBeginResponse {
    if (
        typeof value.deviceCode !== 'string' ||
        typeof value.expiresAt !== 'string' ||
        !Number.isSafeInteger(value.pollingIntervalMs) ||
        value.pollingIntervalMs <= 0 ||
        typeof value.userCode !== 'string' ||
        typeof value.verificationUrl !== 'string'
    ) {
        throw new Error('Server returned an invalid Computer login grant.');
    }
}

function assertPollResponse(
    value: ComputerLoginPollResponse
): asserts value is ComputerLoginPollResponse {
    if (value.status === 'pending') {
        if (!Number.isSafeInteger(value.pollingIntervalMs) || value.pollingIntervalMs <= 0) {
            throw new Error('Server returned an invalid Computer login polling interval.');
        }
        return;
    }
    if (
        typeof value.accessToken !== 'string' ||
        typeof value.accessTokenExpiresAt !== 'string' ||
        typeof value.origin !== 'string' ||
        typeof value.refreshToken !== 'string' ||
        typeof value.refreshTokenExpiresAt !== 'string' ||
        typeof value.sessionId !== 'string'
    ) {
        throw new Error('Server returned an invalid Computer login session.');
    }
}

function assertOriginBoundSession(session: ComputerLoginApprovedResponse, requestedOrigin: string) {
    if (normalizeHttpOrigin(session.origin) !== requestedOrigin) {
        throw new Error('Server returned a Computer login session for another origin.');
    }
}
