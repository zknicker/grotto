import { spawn } from 'node:child_process';
import type { AgentRuntimeUpdate } from '@tavern/api';
import { publishRuntimeEvent } from './runtime-events.ts';
import { getRuntimeInfo } from './status';

let updateStatus: AgentRuntimeUpdate = idleUpdateStatus();

function idleUpdateStatus(): AgentRuntimeUpdate {
    return {
        currentVersion: getRuntimeInfo().version,
        finishedAt: null,
        message: null,
        phase: 'idle',
        startedAt: null,
        targetVersion: null,
    };
}

export function getRuntimeUpdateStatus() {
    return updateStatus;
}

export function startRuntimeUpdate(input?: { targetVersion?: null | string }) {
    if (updateStatus.phase === 'installing' || updateStatus.phase === 'staged') {
        return updateStatus;
    }

    const startedAt = new Date().toISOString();
    updateStatus = {
        currentVersion: getRuntimeInfo().version,
        finishedAt: null,
        message: 'Installing the Runtime update. Restart is held until Grotto is ready.',
        phase: 'installing',
        startedAt,
        targetVersion: input?.targetVersion ?? null,
    };
    publishUpdateChanged();

    // After staging, pre-install the staged Runtime's pinned agent engine with
    // the staged binary (only it knows the new pin). Best-effort: a pre-stage
    // failure must not fail staging — restart-time setup is the safety net.
    const stageCommand =
        'brew update && brew upgrade grotto-runtime && ' +
        '{ "$(brew --prefix)/bin/grotto" engine install || ' +
        'echo "agent engine pre-stage failed; the restart will install it"; }';
    const child = spawn('sh', ['-lc', stageCommand], {
        env: process.env,
        stdio: 'ignore',
    });
    child.once('error', (error) => {
        updateStatus = {
            ...updateStatus,
            finishedAt: new Date().toISOString(),
            message: error.message,
            phase: 'failed',
        };
        publishUpdateChanged();
    });
    child.once('exit', (code) => {
        updateStatus =
            code === 0
                ? {
                      ...updateStatus,
                      finishedAt: new Date().toISOString(),
                      message: 'Runtime update staged. Restart Grotto to finish.',
                      phase: 'staged',
                  }
                : {
                      ...updateStatus,
                      finishedAt: new Date().toISOString(),
                      message: `Runtime update failed with exit code ${code ?? 'unknown'}.`,
                      phase: 'failed',
                  };
        publishUpdateChanged();
    });

    return updateStatus;
}

export function restartRuntimeForUpdate() {
    if (updateStatus.phase === 'restarting') {
        return updateStatus;
    }

    updateStatus = {
        ...updateStatus,
        finishedAt: null,
        message: 'Restarting Grotto Runtime.',
        phase: 'restarting',
        startedAt: updateStatus.startedAt ?? new Date().toISOString(),
    };
    publishUpdateChanged();

    const restartCommand = 'brew services restart grotto-runtime';
    const child = spawn('sh', ['-lc', restartCommand], {
        detached: true,
        env: process.env,
        stdio: 'ignore',
    });
    child.once('error', (error) => {
        updateStatus = {
            ...updateStatus,
            finishedAt: new Date().toISOString(),
            message: error.message,
            phase: 'failed',
        };
        publishUpdateChanged();
    });
    child.unref();

    return updateStatus;
}

function publishUpdateChanged() {
    publishRuntimeEvent({
        timestamp: new Date().toISOString(),
        type: 'runtime.update',
    });
}
