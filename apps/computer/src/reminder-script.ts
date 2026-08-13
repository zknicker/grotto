import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface ReminderScriptCommand {
    agentId: string;
    attentionId: string;
    fireId: string;
    reminderId: string;
    script: string;
    type: 'reminder-script';
}

export interface ReminderScriptResult {
    agentId: string;
    attentionId: string;
    exitCode: number;
    fireId: string;
    output: string;
    timedOut: boolean;
    type: 'reminder-script-result';
}

const scriptTimeoutMs = 60_000;
const maxOutputBytes = 65_536;
const runningScripts = new Map<string, Promise<ReminderScriptResult>>();

export function parseReminderScriptCommand(frame: unknown): ReminderScriptCommand | null {
    if (
        !isRecord(frame) ||
        frame.type !== 'reminder-script' ||
        !['agentId', 'attentionId', 'fireId', 'reminderId', 'script'].every(
            (field) => typeof frame[field] === 'string' && frame[field].length > 0
        ) ||
        Buffer.byteLength(frame.script as string) > 16_384
    ) {
        return null;
    }
    return frame as unknown as ReminderScriptCommand;
}

/** Executes once in the Agent workspace; a redelivered command replays the durable result. */
export async function runReminderScript(input: {
    command: ReminderScriptCommand;
    dataRoot: string;
    serverId: string;
}): Promise<ReminderScriptResult> {
    const agentRoot = join(
        input.dataRoot,
        'servers',
        input.serverId,
        'agents',
        input.command.agentId
    );
    const resultDir = join(agentRoot, 'runtime', 'reminder-results');
    const resultPath = join(resultDir, `${input.command.attentionId}.json`);
    const running = runningScripts.get(resultPath);
    if (running) {
        return running;
    }
    const execution = executeReminderScript({ ...input, agentRoot, resultDir, resultPath });
    runningScripts.set(resultPath, execution);
    try {
        return await execution;
    } finally {
        if (runningScripts.get(resultPath) === execution) {
            runningScripts.delete(resultPath);
        }
    }
}

async function executeReminderScript(
    input: Parameters<typeof runReminderScript>[0] & {
        agentRoot: string;
        resultDir: string;
        resultPath: string;
    }
): Promise<ReminderScriptResult> {
    const prior = await readResult(input.resultPath);
    if (prior) {
        return prior;
    }
    const workspace = join(input.agentRoot, 'workspace');
    const home = join(input.agentRoot, 'home');
    await Promise.all([
        mkdir(input.resultDir, { mode: 0o700, recursive: true }),
        mkdir(workspace, { mode: 0o700, recursive: true }),
        mkdir(home, { mode: 0o700, recursive: true }),
    ]);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, scriptTimeoutMs);
    const child = Bun.spawn(['/bin/zsh', '-lc', input.command.script], {
        cwd: workspace,
        env: reminderScriptEnvironment(home),
        signal: controller.signal,
        stderr: 'pipe',
        stdout: 'pipe',
    });
    const [stdout, stderr, exitCode] = await Promise.all([
        readLimited(child.stdout, maxOutputBytes),
        readLimited(child.stderr, maxOutputBytes),
        child.exited.catch(() => (timedOut ? 124 : 1)),
    ]).finally(() => clearTimeout(timeout));
    const output = truncateUtf8([stdout, stderr].filter(Boolean).join('\n'), maxOutputBytes);
    const result: ReminderScriptResult = {
        agentId: input.command.agentId,
        attentionId: input.command.attentionId,
        exitCode: timedOut ? 124 : exitCode,
        fireId: input.command.fireId,
        output,
        timedOut,
        type: 'reminder-script-result',
    };
    const temporary = `${input.resultPath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(result), { mode: 0o600 });
    await rename(temporary, input.resultPath);
    return result;
}

function reminderScriptEnvironment(home: string): Record<string, string> {
    const environment: Record<string, string> = {
        HOME: home,
        PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    };
    for (const name of ['LANG', 'LC_ALL', 'TMPDIR'] as const) {
        const value = process.env[name];
        if (value) {
            environment[name] = value;
        }
    }
    return environment;
}

async function readResult(path: string): Promise<ReminderScriptResult | null> {
    try {
        const value = JSON.parse(await readFile(path, 'utf8')) as unknown;
        return isResult(value) ? value : null;
    } catch {
        return null;
    }
}

async function readLimited(stream: ReadableStream<Uint8Array>, limit: number) {
    let output = '';
    for await (const chunk of stream) {
        if (output.length < limit) {
            output += new TextDecoder().decode(chunk).slice(0, limit - output.length);
        }
    }
    return output;
}

function truncateUtf8(value: string, maxBytes: number): string {
    let bytes = 0;
    let result = '';
    for (const character of value) {
        const characterBytes = Buffer.byteLength(character);
        if (bytes + characterBytes > maxBytes) {
            break;
        }
        result += character;
        bytes += characterBytes;
    }
    return result;
}

function isResult(value: unknown): value is ReminderScriptResult {
    return (
        isRecord(value) &&
        value.type === 'reminder-script-result' &&
        typeof value.agentId === 'string' &&
        typeof value.attentionId === 'string' &&
        typeof value.fireId === 'string' &&
        typeof value.exitCode === 'number' &&
        typeof value.output === 'string' &&
        typeof value.timedOut === 'boolean'
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
