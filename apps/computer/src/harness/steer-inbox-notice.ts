import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { HarnessCapabilityUnsupportedError } from '@ai-sdk/harness';
import type { HarnessAgentSession } from '@ai-sdk/harness/agent';
import { Effect } from 'effect';
import type { DaemonRuntime } from '../daemon-runtime.ts';

export function createNoticeDelivery(
    session: HarnessAgentSession,
    runtime: DaemonRuntime,
    agentRoot: string,
    alreadyVisible: string | null = null
) {
    let lastDelivered: string | null = alreadyVisible;
    return async (notice: string) => {
        if (!notice.trim()) {
            return false;
        }
        if (notice !== lastDelivered && !(await storedNoticeMatches(agentRoot, notice))) {
            return false;
        }
        const accepted =
            notice === lastDelivered || (await steerInboxNotice(session, notice, runtime));
        if (accepted) {
            lastDelivered = notice;
            await clearStoredNoticeIfMatching(agentRoot, notice);
        }
        return accepted;
    };
}

async function storedNoticeMatches(agentRoot: string, notice: string): Promise<boolean> {
    try {
        const value = JSON.parse(await readFile(pendingNoticePath(agentRoot), 'utf8')) as {
            notice?: unknown;
        };
        return value.notice === notice;
    } catch (cause) {
        if (isRecord(cause) && cause.code === 'ENOENT') {
            return false;
        }
        throw cause;
    }
}

async function clearStoredNoticeIfMatching(agentRoot: string, notice: string) {
    const path = pendingNoticePath(agentRoot);
    try {
        const value = JSON.parse(await readFile(path, 'utf8')) as { notice?: unknown };
        if (value.notice === notice) {
            await rm(path, { force: true });
        }
    } catch (cause) {
        if (!(isRecord(cause) && cause.code === 'ENOENT')) {
            throw cause;
        }
    }
}

function pendingNoticePath(agentRoot: string) {
    return join(agentRoot, 'runtime', 'pending-notice.json');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object';
}

/** Unsupported steering leaves the durable notice for the next turn. */
export async function steerInboxNotice(
    session: Pick<HarnessAgentSession, 'experimental_steerTurn' | 'hasUnfinishedTurn'>,
    notice: string,
    runtime: DaemonRuntime
): Promise<boolean> {
    try {
        await session.experimental_steerTurn(notice);
        return true;
    } catch (error) {
        if (session.hasUnfinishedTurn() && !HarnessCapabilityUnsupportedError.isInstance(error)) {
            await runtime.runPromise(
                Effect.logWarning('Inbox notice delivery failed; retained for the next turn.').pipe(
                    Effect.annotateLogs({
                        event: 'inbox-notice-deferred',
                        errorType: error instanceof Error ? error.name : 'unknown',
                    })
                )
            );
        }
        return false;
    }
}
