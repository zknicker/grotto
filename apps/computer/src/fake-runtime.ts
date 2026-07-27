#!/usr/bin/env bun
/**
 * A deterministic runtime that executes the real managed CLI. It stands in for
 * a model provider — no network model call — while exercising the genuine path:
 * it reads the composed turn prompt and replies through the `grotto` wrapper on
 * PATH, which reaches the Server via the loopback proxy. Real harness/CLI,
 * fake model.
 */
async function main(): Promise<number> {
    const prompt = process.env.GROTTO_TURN_PROMPT ?? '';
    const ask = readLatestHumanMessage(prompt);
    const mcp = readMcpRequest(prompt);
    const reply = mcp ? await invokeMcp(mcp) : ask ? `Acknowledged: ${ask}` : 'Acknowledged.';

    const grotto = Bun.which('grotto') ?? process.env.GROTTO_WRAPPER;
    if (!grotto) {
        process.stderr.write('The grotto wrapper was not found on PATH.\n');
        return 1;
    }

    const child = Bun.spawn([grotto, 'message', 'send', '--target', 'dm:@operator'], {
        stderr: 'inherit',
        stdin: new TextEncoder().encode(reply),
        stdout: 'inherit',
    });
    return await child.exited;
}

function readMcpRequest(prompt: string) {
    const match = /\[mcp=([^/\]]+)\/([^\]]+)\]\s*(\{.*\})/u.exec(prompt);
    if (!(match?.[1] && match[2] && match[3])) {
        return null;
    }
    return {
        args: JSON.parse(match[3]) as unknown,
        connectionId: match[1],
        toolName: match[2],
    };
}

async function invokeMcp(input: { args: unknown; connectionId: string; toolName: string }) {
    const url = process.env.GROTTO_MCP_URL;
    const token = process.env.GROTTO_MCP_TOKEN;
    if (!(url && token)) {
        throw new Error('The attachment MCP endpoint is unavailable.');
    }
    const response = await fetch(url, {
        body: JSON.stringify(input),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        method: 'POST',
    });
    const payload = (await response.json()) as { error?: string; result?: unknown };
    if (!response.ok) {
        throw new Error(payload.error ?? 'MCP invocation failed.');
    }
    return JSON.stringify(payload.result);
}

function readLatestHumanMessage(prompt: string): string | null {
    const matches = [...prompt.matchAll(/\[target=\S+ type=human\]\s*(.*)/gu)];
    return matches.at(-1)?.[1]?.trim() ?? null;
}

if (import.meta.main) {
    main()
        .then((code) => {
            process.exitCode = code;
        })
        .catch((error) => {
            process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
            process.exitCode = 1;
        });
}
