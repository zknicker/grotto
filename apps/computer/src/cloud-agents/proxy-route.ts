import * as z from 'zod';
import { CloudAgentProviderUnavailableError } from './provider.ts';
import { CloudAgentLaunchFailedError, startCloudAgentWork } from './work-runner.ts';

const cloudAgentStartSchema = z.object({
    content: z.string().trim().min(1),
    instructions: z.string().trim().min(1),
    nonce: z.string().trim().min(1),
    repository: z.string().trim().min(1),
    startingRef: z.string().trim().min(1).nullable(),
    target: z.string().trim().min(1),
    title: z.string().trim().min(1),
});

/**
 * `grotto cloud-agent start` runs here, not upstream: the Computer owns the
 * provider access, so it checks readiness before Server records anything and
 * keeps the provider instructions local. Cancellation needs none of that and
 * forwards to Server, which rides the cancel back down this Computer's socket.
 */
export async function handleCloudAgentStart(
    request: Request,
    url: URL,
    input: { runnerToken: string; serverId?: string; serverOrigin: string }
): Promise<Response | null> {
    if (!(url.pathname === '/api/agent/cloud-agents' && request.method === 'POST')) {
        return null;
    }
    if (!input.serverId) {
        return Response.json(
            {
                code: 'CLOUD_AGENT_UNAVAILABLE',
                message: 'This launch has no attached Server to record Cloud Agent work.',
            },
            { status: 409 }
        );
    }
    let parsed: z.infer<typeof cloudAgentStartSchema>;
    try {
        parsed = cloudAgentStartSchema.parse(await request.json());
    } catch (error) {
        return Response.json(
            {
                code: 'INVALID_ARG',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 400 }
        );
    }
    try {
        return Response.json(
            await startCloudAgentWork({
                request: parsed,
                runnerToken: input.runnerToken,
                serverId: input.serverId,
                serverOrigin: input.serverOrigin,
            })
        );
    } catch (error) {
        if (error instanceof CloudAgentProviderUnavailableError) {
            return Response.json(
                { code: 'CLOUD_AGENT_UNAVAILABLE', message: error.message },
                { status: 409 }
            );
        }
        if (error instanceof CloudAgentLaunchFailedError) {
            return Response.json(
                {
                    code: 'CLOUD_AGENT_LAUNCH_FAILED',
                    message: `${error.message} The work is recorded as failed; read it in the thread.`,
                },
                { status: 502 }
            );
        }
        const failure = error as { code?: unknown; message?: unknown };
        return Response.json(
            {
                code: typeof failure.code === 'string' ? failure.code : 'SERVER_5XX',
                message:
                    typeof failure.message === 'string'
                        ? failure.message
                        : 'The Server could not record the Cloud Agent work.',
            },
            { status: 502 }
        );
    }
}
