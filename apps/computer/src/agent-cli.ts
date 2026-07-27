import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

interface CliFailure {
    code: string;
    message: string;
    nextAction?: string;
    usage?: boolean;
}

/**
 * The embedded Agent CLI. `grotto-computer` re-executes this behind the managed
 * `grotto` wrapper. It is the Agent's only collaboration output channel: text
 * emitted outside `grotto message send` reaches no one. Identity comes from the
 * baked wrapper env and fails closed — never a fallback to another credential.
 */
export async function runAgentCli(argv: string[]): Promise<number> {
    if (argv[0] !== 'message' || argv[1] !== 'send') {
        return fail({
            code: 'INVALID_ARG',
            message: 'Only `grotto message send` is available in this build.',
            usage: true,
        });
    }

    const parsed = parseSendArgs(argv.slice(2));
    if ('code' in parsed) {
        return fail(parsed);
    }

    const identity = readIdentity();
    if ('code' in identity) {
        return fail(identity);
    }

    const token = await readProxyToken(identity.tokenFile);
    if ('code' in token) {
        return fail(token);
    }

    const content = (await Bun.stdin.text()).trim();
    if (!content) {
        return fail({
            code: 'MISSING_CONTENT',
            message: 'Message bodies are read from stdin.',
            nextAction: 'Pipe the body via a GROTTOMSG heredoc.',
        });
    }

    try {
        const response = await fetch(new URL('/api/agent/messages/send', identity.proxyUrl), {
            body: JSON.stringify({
                content,
                nonce: parsed.nonce ?? `grta_${randomBytes(12).toString('base64url')}`,
                target: parsed.target,
            }),
            headers: {
                authorization: `Bearer ${token.value}`,
                'content-type': 'application/json',
            },
            method: 'POST',
        });
        return await renderSendResponse(response, parsed.target);
    } catch {
        return fail({ code: 'SERVER_5XX', message: 'The Grotto Computer proxy was unreachable.' });
    }
}

function parseSendArgs(args: string[]): { nonce?: string; target: string } | CliFailure {
    const stdinOnly = 'Message bodies are stdin-only; pipe the body via a GROTTOMSG heredoc.';
    let target: string | null = null;
    let nonce: string | undefined;
    let index = 0;
    while (index < args.length) {
        const arg = args[index];
        if (arg === '--target') {
            target = args[index + 1] ?? null;
            index += 2;
        } else if (arg === '--nonce') {
            nonce = args[index + 1];
            index += 2;
        } else if (arg === '--content') {
            return { code: 'CONTENT_FLAG_UNSUPPORTED', message: stdinOnly, usage: true };
        } else if (arg.startsWith('--')) {
            index += 1;
        } else {
            return { code: 'POSITIONAL_CONTENT_UNSUPPORTED', message: stdinOnly, usage: true };
        }
    }
    if (!target) {
        return { code: 'INVALID_TARGET', message: '--target is required.', usage: true };
    }
    return { nonce, target };
}

function readIdentity(): { proxyUrl: string; tokenFile: string } | CliFailure {
    const proxyUrl = process.env.GROTTO_AGENT_PROXY_URL;
    if (!proxyUrl) {
        return { code: 'MISSING_SERVER_URL', message: 'GROTTO_AGENT_PROXY_URL is not set.' };
    }
    const tokenFile = process.env.GROTTO_AGENT_PROXY_TOKEN_FILE;
    if (!tokenFile) {
        return { code: 'MISSING_TOKEN', message: 'GROTTO_AGENT_PROXY_TOKEN_FILE is not set.' };
    }
    return { proxyUrl, tokenFile };
}

async function readProxyToken(tokenFile: string): Promise<{ value: string } | CliFailure> {
    let raw: string;
    try {
        raw = await readFile(tokenFile, 'utf8');
    } catch {
        return { code: 'TOKEN_FILE_UNREADABLE', message: 'The local proxy token is unreadable.' };
    }
    const value = raw.trim();
    if (!value) {
        return { code: 'TOKEN_FILE_EMPTY', message: 'The local proxy token file is empty.' };
    }
    return { value };
}

async function renderSendResponse(response: Response, target: string): Promise<number> {
    if (response.ok) {
        const payload = (await response.json()) as { receipt?: { messageId?: string } };
        const messageId = payload.receipt?.messageId ?? 'unknown';
        process.stdout.write(`Message sent to ${target}. Message ID: ${messageId}\n`);
        return 0;
    }
    let body: { code?: string; message?: string; nextAction?: string } = {};
    try {
        body = (await response.json()) as typeof body;
    } catch {
        // A non-JSON error body still fails closed below.
    }
    return fail({
        code: response.status >= 500 ? 'SERVER_5XX' : (body.code ?? 'SEND_FAILED'),
        message: body.message ?? 'The message send failed.',
        nextAction: body.nextAction,
    });
}

function fail(failure: CliFailure): number {
    const lines = [`Error: ${failure.message}`, `Code: ${failure.code}`];
    if (failure.nextAction) {
        lines.push(`Next action: ${failure.nextAction}`);
    }
    process.stderr.write(`${lines.join('\n')}\n`);
    return failure.usage ? 2 : 1;
}
