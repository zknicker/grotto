import { computerMachineUnlinkedExitCode } from './attachment-recovery.ts';

export interface AttachmentConnectionOutcome {
    /** The socket opened, so the Server was reachable before this close. */
    connected: boolean;
    /** The Server deleted itself; the attachment partition is being purged. */
    deleted: boolean;
}

export interface AttachmentDaemonHooks {
    attachmentExists(): Promise<boolean>;
    connect(): Promise<AttachmentConnectionOutcome>;
    isTerminalUnlinkedError(error: unknown): boolean;
    log(message: string): void;
    markTerminalUnlinked(): Promise<void>;
    oneshot: boolean;
    sleep(ms: number): Promise<void>;
    validate(): Promise<void>;
}

export const attachmentDaemonInitialRetryMs = 500;
export const attachmentDaemonMaxRetryMs = 15_000;

/**
 * Runs the attachment daemon until a terminal outcome and returns the process
 * exit code. Transient failures — a restarting Server, a refused socket, a
 * failed validation — never end the daemon: the dev resident spawns daemons
 * under `bun --watch`, where a finished script leaves an idle watcher holding
 * the daemon's pid, so the resident's pid-liveness check would never respawn
 * it. The daemon owns its reconnect with capped exponential backoff instead,
 * exiting only for terminal unlink, Server deletion, a detached Server, or
 * oneshot test runs.
 */
export async function runAttachmentDaemon(hooks: AttachmentDaemonHooks): Promise<number> {
    let retryMs = attachmentDaemonInitialRetryMs;
    const retry = async (reason: string) => {
        hooks.log(`Reconnecting to the Server in ${retryMs}ms: ${reason}`);
        const delayMs = retryMs;
        retryMs = Math.min(retryMs * 2, attachmentDaemonMaxRetryMs);
        await hooks.sleep(delayMs);
    };
    for (;;) {
        if (!(await hooks.attachmentExists())) {
            return 0;
        }
        try {
            await hooks.validate();
        } catch (error) {
            if (hooks.isTerminalUnlinkedError(error)) {
                await hooks.markTerminalUnlinked();
                return computerMachineUnlinkedExitCode;
            }
            if (hooks.oneshot) {
                throw error;
            }
            await retry(error instanceof Error ? error.message : String(error));
            continue;
        }
        let outcome: AttachmentConnectionOutcome;
        try {
            outcome = await hooks.connect();
        } catch (error) {
            // A connect that failed before the socket existed is as transient
            // as a refused socket; only oneshot runs surface it.
            if (hooks.oneshot) {
                throw error;
            }
            await retry(error instanceof Error ? error.message : String(error));
            continue;
        }
        if (outcome.deleted) {
            return 0;
        }
        if (hooks.oneshot) {
            return outcome.connected ? 0 : 1;
        }
        if (outcome.connected) {
            retryMs = attachmentDaemonInitialRetryMs;
        }
        await retry(
            outcome.connected
                ? 'the Server closed the attachment socket'
                : 'the attachment socket did not open'
        );
    }
}
