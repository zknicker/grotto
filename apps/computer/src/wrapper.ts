import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface WrapperIdentity {
    agentId: string;
    proxyTokenFile: string;
    proxyUrl: string;
    serverUrl: string;
}

/**
 * Writes the managed `haus` wrapper the Agent runs. It re-executes this
 * Computer binary's embedded Agent CLI with the launch's identity env baked in,
 * so the Agent's only reachable authority is the per-launch loopback proxy
 * token — never the Server-valid runner credential the Computer holds.
 */
export async function writeHausWrapper(input: {
    binDir: string;
    entrypoint: { args: string[]; executable: string };
    identity: WrapperIdentity;
}): Promise<string> {
    const wrapperPath = join(input.binDir, 'haus');
    const command = [input.entrypoint.executable, ...input.entrypoint.args, '__agent']
        .map(shellQuote)
        .join(' ');
    const script = [
        '#!/bin/sh',
        `export GROTTO_AGENT_ID=${shellQuote(input.identity.agentId)}`,
        `export GROTTO_SERVER_URL=${shellQuote(input.identity.proxyUrl)}`,
        `export GROTTO_AGENT_TOKEN_FILE=${shellQuote(input.identity.proxyTokenFile)}`,
        `export GROTTO_AGENT_PROXY_URL=${shellQuote(input.identity.proxyUrl)}`,
        `export GROTTO_AGENT_PROXY_TOKEN_FILE=${shellQuote(input.identity.proxyTokenFile)}`,
        `exec ${command} "$@"`,
        '',
    ].join('\n');
    // Resumed Agent histories may still invoke the former command name.
    for (const path of [wrapperPath, join(input.binDir, 'grotto')]) {
        await writeFile(path, script, { mode: 0o755 });
        await chmod(path, 0o755);
    }
    return wrapperPath;
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}
