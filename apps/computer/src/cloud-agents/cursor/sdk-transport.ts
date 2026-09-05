import type {
    Agent as CursorAgentApi,
    Cursor as CursorApi,
    Run,
    RunStatus,
    SDKMessage,
} from '@cursor/sdk';
import {
    type CursorAuth,
    type CursorLaunchReading,
    type CursorRunAddress,
    type CursorRunEvent,
    type CursorRunReading,
    type CursorRunStatus,
    type CursorStartInput,
    type CursorTransport,
    CursorTransportUnavailableError,
    isCursorRunStatus,
} from './transport.ts';

interface CursorSdk {
    Agent: typeof CursorAgentApi;
    Cursor: typeof CursorApi;
}

/**
 * The live `@cursor/sdk` transport. The SDK is imported lazily so a Computer
 * that cannot load it — an unsupported platform, a missing native optional
 * dependency — still starts, reports `provider-unavailable`, and runs every
 * other capability.
 *
 * The user API key is read only by the SDK. Nothing here logs it, returns it,
 * or hands it to a caller: `CURSOR_API_KEY` and `~/.cursor/sdk/auth.json` stay
 * the SDK's own business.
 */
export function createCursorSdkTransport(
    loadSdk: () => Promise<CursorSdk> = () => import('@cursor/sdk')
): CursorTransport {
    let sdk: Promise<CursorSdk> | null = null;
    const load = async (): Promise<CursorSdk> => {
        sdk ??= loadSdk();
        try {
            return await sdk;
        } catch (cause) {
            sdk = null;
            throw new CursorTransportUnavailableError(cause);
        }
    };

    return {
        async authStatus(): Promise<CursorAuth> {
            const { Cursor } = await load();
            if (process.env.CURSOR_API_KEY) {
                // An explicitly configured key outranks the credential store
                // and carries no expiry of its own.
                return { connected: true, email: null, expiresAt: null };
            }
            const status = await Cursor.auth.status();
            if (status.status === 'logged-out') {
                return { connected: false, reason: 'not-connected' };
            }
            if (status.apiKeyExpiresAtMs !== undefined && status.apiKeyExpiresAtMs <= Date.now()) {
                return { connected: false, reason: 'expired' };
            }
            return {
                connected: true,
                email: status.email ?? null,
                expiresAt:
                    status.apiKeyExpiresAtMs === undefined
                        ? null
                        : new Date(status.apiKeyExpiresAtMs).toISOString(),
            };
        },
        async cancelRun(address: CursorRunAddress): Promise<void> {
            const { Agent } = await load();
            await Agent.cancelRun(address.runId, { agentId: address.agentId, runtime: 'cloud' });
        },
        async login(options: { onLoginUrl?: (url: string) => void }): Promise<CursorAuth> {
            const { Cursor } = await load();
            const result = await Cursor.auth.login(
                options.onLoginUrl ? { onLoginUrl: options.onLoginUrl } : {}
            );
            return {
                connected: true,
                email: result.email ?? null,
                expiresAt: new Date(result.apiKeyExpiresAtMs).toISOString(),
            };
        },
        async logout(): Promise<void> {
            const { Cursor } = await load();
            await Cursor.auth.logout();
        },
        async readRun(address: CursorRunAddress): Promise<CursorRunReading> {
            const { Agent } = await load();
            const run = await Agent.getRun(address.runId, {
                agentId: address.agentId,
                runtime: 'cloud',
            });
            return await readingOf(Agent, address.agentId, run);
        },
        async start(input: CursorStartInput): Promise<CursorLaunchReading> {
            const { Agent } = await load();
            // `Agent.create` returns a handle before Cursor persists anything;
            // this first `send` is what creates the hosted Run.
            const agent = await Agent.create({
                cloud: {
                    autoCreatePR: true,
                    repos: [
                        {
                            url: `https://github.com/${input.repository}`,
                            ...(input.ref ? { startingRef: input.ref } : {}),
                        },
                    ],
                },
                idempotencyKey: input.idempotencyKey,
                name: input.title,
            });
            try {
                const run = await agent.send(input.instructions, {
                    idempotencyKey: input.idempotencyKey,
                });
                return {
                    agentId: agent.agentId,
                    reading: await readingOf(Agent, agent.agentId, run),
                };
            } finally {
                agent.close();
            }
        },
        streamRun(address: CursorRunAddress, onEvent: (event: CursorRunEvent) => void): () => void {
            let stopped = false;
            void streamCursorRun(load, address, onEvent, () => stopped);
            return () => {
                stopped = true;
            };
        },
    };
}

/**
 * Cursor's per-Run event stream, consumed while the Run is active. Its `status`
 * messages carry the raw lifecycle status — the only place `EXPIRED` survives,
 * since a Run read through the public SDK normalizes it to `error`.
 *
 * The end of this stream is never a settlement. The SDK's own run handle stops
 * streaming after its client-side wait deadline and locally marks itself
 * errored while the hosted Run keeps working, so every exit reports `detached`
 * and lets the adapter reconcile by reading the Run.
 */
async function streamCursorRun(
    load: () => Promise<CursorSdk>,
    address: CursorRunAddress,
    onEvent: (event: CursorRunEvent) => void,
    isStopped: () => boolean
): Promise<void> {
    try {
        const { Agent } = await load();
        const run = await Agent.getRun(address.runId, {
            agentId: address.agentId,
            runtime: 'cloud',
        });
        if (run.supports('stream')) {
            for await (const message of run.stream()) {
                if (isStopped()) {
                    return;
                }
                const event = eventOf(message);
                if (event) {
                    onEvent(event);
                }
            }
        }
    } catch (error) {
        console.error(
            `Cursor run ${address.runId} stream ended: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
    if (!isStopped()) {
        onEvent({ kind: 'detached' });
    }
}

function eventOf(message: SDKMessage): CursorRunEvent | null {
    if (message.type === 'status' && isCursorRunStatus(message.status)) {
        return { kind: 'status', rawStatus: message.status };
    }
    if (message.type === 'task' && message.text) {
        return { kind: 'activity', summary: message.text };
    }
    if (message.type === 'tool_call') {
        return { kind: 'activity', summary: `Running ${message.name}` };
    }
    return null;
}

async function readingOf(
    agentApi: typeof CursorAgentApi,
    agentId: string,
    run: Run
): Promise<CursorRunReading> {
    return {
        branches: (run.git?.branches ?? []).map((branch) => ({
            branch: branch.branch ?? null,
            prUrl: branch.prUrl ?? null,
            repoUrl: branch.repoUrl,
        })),
        errorCode: run.error?.code ?? null,
        errorMessage: run.error?.message ?? null,
        rawStatus: rawStatusOf(run.status, run.error),
        result: run.result ?? null,
        runId: run.id,
        usage: await usageOf(agentApi, agentId, run),
    };
}

/**
 * The SDK collapses `EXPIRED` into `error`, so an expired Run is recoverable
 * from a read only through the error Cursor reports with it. A live stream's
 * own `status` message is authoritative when one arrives.
 */
function rawStatusOf(
    status: RunStatus,
    error: { code?: string; message: string } | undefined
): CursorRunStatus {
    switch (status) {
        case 'running':
            return 'RUNNING';
        case 'finished':
            return 'FINISHED';
        case 'cancelled':
            return 'CANCELLED';
        case 'error':
            return looksExpired(error) ? 'EXPIRED' : 'ERROR';
    }
}

function looksExpired(error: { code?: string; message: string } | undefined): boolean {
    return /expired/iu.test(`${error?.code ?? ''} ${error?.message ?? ''}`);
}

/** Per-Run tokens and cost, when Cursor has reported them for this Run. */
async function usageOf(
    agentApi: typeof CursorAgentApi,
    agentId: string,
    run: Run
): Promise<CursorRunReading['usage']> {
    try {
        const usage = await agentApi.getUsage(agentId, { runId: run.id });
        const entry = usage.runs.find((candidate) => candidate.runId === run.id);
        const tokens = entry?.usage ?? run.usage;
        if (!tokens) {
            return null;
        }
        return {
            chargedCents: entry?.cost?.chargedCents ?? null,
            inputTokens: tokens.inputTokens,
            outputTokens: tokens.outputTokens,
        };
    } catch {
        // Usage is reported separately and can lag a terminal Run. Missing
        // usage is a missing field, never a failed observation.
        return run.usage
            ? {
                  chargedCents: null,
                  inputTokens: run.usage.inputTokens,
                  outputTokens: run.usage.outputTokens,
              }
            : null;
    }
}
