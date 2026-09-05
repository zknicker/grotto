import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type EffectRuntime, settle } from '@grotto/effect';
import {
    liveReminderScriptExecution,
    type ReminderScriptExecutionRunner,
} from './reminder-script-execution.ts';

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
    runtime: EffectRuntime<never>;
    serverId: string;
}): Promise<ReminderScriptResult> {
    return await runReminderScriptWithExecution(input, liveReminderScriptExecution);
}

export async function runReminderScriptWithExecution(
    input: {
        command: ReminderScriptCommand;
        dataRoot: string;
        runtime: EffectRuntime<never>;
        serverId: string;
    },
    executionRunner: ReminderScriptExecutionRunner
): Promise<ReminderScriptResult> {
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
    const execution = executeReminderScript({
        ...input,
        agentRoot,
        executionRunner,
        resultDir,
        resultPath,
    });
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
        executionRunner: ReminderScriptExecutionRunner;
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

    const execution = await runExecution(
        input.runtime,
        input.executionRunner({
            cwd: workspace,
            env: reminderScriptEnvironment(home),
            script: input.command.script,
        })
    );
    const result: ReminderScriptResult = {
        agentId: input.command.agentId,
        attentionId: input.command.attentionId,
        exitCode: execution.exitCode,
        fireId: input.command.fireId,
        output: execution.output,
        timedOut: execution.timedOut,
        type: 'reminder-script-result',
    };
    const temporary = `${input.resultPath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(result), { mode: 0o600 });
    await rename(temporary, input.resultPath);
    return result;
}

async function runExecution(
    runtime: EffectRuntime<never>,
    execution: ReturnType<ReminderScriptExecutionRunner>
) {
    return await settle(runtime, execution);
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
