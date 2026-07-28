import * as z from 'zod';
import {
    createLocalAgentSkill,
    deleteLocalAgentSkill,
    listLocalAgentSkills,
    patchLocalAgentSkill,
    viewLocalAgentSkill,
    writeLocalAgentSkillFile,
} from './agent-skills.ts';

const skillCreateSchema = z.object({
    content: z.string().min(1),
    description: z.string().trim().min(1),
    name: z.string().trim().min(1),
});
const skillPatchSchema = z.object({
    content: z.string().min(1),
    expectedHash: z.string().min(1),
    skillId: z.string().min(1),
});
const skillFileSchema = z.object({
    content: z.string(),
    expectedHash: z.string().min(1).nullable(),
    filePath: z.string().min(1),
    skillId: z.string().min(1),
});

export interface LoopbackProxy {
    close(): void;
    sendCount(): number;
    url: string;
}

/**
 * The per-launch loopback proxy. The Agent authenticates to it with a local-only
 * token; the proxy forwards `/api/agent/*` to the hosted Server with the scoped
 * runner credential. The runner credential never leaves this process, so the
 * Agent can act as itself without ever holding Server-valid authority.
 */
export function startLoopbackProxy(input: {
    agentId?: string;
    dataRoot?: string;
    proxyToken: string;
    runnerToken: string;
    serverId?: string;
    serverOrigin: string;
    skillsDir?: string;
}): LoopbackProxy {
    let sends = 0;
    const server = Bun.serve({
        fetch: async (request) => {
            const url = new URL(request.url);
            if (!url.pathname.startsWith('/api/agent/')) {
                return new Response('Not found', { status: 404 });
            }
            if (!isAuthorized(request, input.proxyToken)) {
                return new Response('Unauthorized', { status: 401 });
            }
            const skillResponse = await handleSkillRequest(request, url, input);
            if (skillResponse) {
                return skillResponse;
            }
            const body = await request.text();
            const upstreamUrl = new URL(url.pathname, input.serverOrigin);
            upstreamUrl.search = url.search;
            const upstream = await fetch(upstreamUrl, {
                body: request.method === 'GET' ? undefined : body,
                headers: {
                    authorization: `Bearer ${input.runnerToken}`,
                    'content-type': request.headers.get('content-type') ?? 'application/json',
                },
                method: request.method,
            });
            const responseBody = await upstream.text();
            if (
                upstream.ok &&
                url.pathname === '/api/agent/messages/send' &&
                isCommittedSend(responseBody)
            ) {
                sends += 1;
            }
            return new Response(responseBody, {
                headers: { 'content-type': 'application/json' },
                status: upstream.status,
            });
        },
        hostname: '127.0.0.1',
        port: 0,
    });
    return {
        close: () => server.stop(true),
        sendCount: () => sends,
        url: `http://127.0.0.1:${server.port}`,
    };
}

async function handleSkillRequest(
    request: Request,
    url: URL,
    input: { agentId?: string; skillsDir?: string }
): Promise<Response | null> {
    if (!(input.agentId && input.skillsDir && url.pathname.startsWith('/api/agent/skills'))) {
        return null;
    }
    try {
        if (url.pathname === '/api/agent/skills' && request.method === 'GET') {
            return Response.json(await listLocalAgentSkills(input.skillsDir));
        }
        if (url.pathname === '/api/agent/skills/create' && request.method === 'POST') {
            return Response.json(
                await createLocalAgentSkill(
                    input.skillsDir,
                    skillCreateSchema.parse(await request.json())
                )
            );
        }
        if (url.pathname === '/api/agent/skills/patch' && request.method === 'POST') {
            return Response.json(
                await patchLocalAgentSkill(
                    input.skillsDir,
                    skillPatchSchema.parse(await request.json())
                )
            );
        }
        if (url.pathname === '/api/agent/skills/write-file' && request.method === 'POST') {
            return Response.json(
                await writeLocalAgentSkillFile(
                    input.skillsDir,
                    skillFileSchema.parse(await request.json())
                )
            );
        }
        const skillId = decodeURIComponent(url.pathname.slice('/api/agent/skills/'.length));
        if (skillId && request.method === 'GET') {
            return Response.json(await viewLocalAgentSkill(input.skillsDir, skillId));
        }
        if (skillId && request.method === 'DELETE') {
            return Response.json(
                await deleteLocalAgentSkill(input.skillsDir, input.agentId, skillId)
            );
        }
        return null;
    } catch (error) {
        return Response.json(
            {
                code: 'INVALID_ARG',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 409 }
        );
    }
}

function isCommittedSend(body: string): boolean {
    try {
        return z.object({ state: z.literal('sent') }).safeParse(JSON.parse(body)).success;
    } catch {
        return false;
    }
}

function isAuthorized(request: Request, proxyToken: string): boolean {
    const header = request.headers.get('authorization');
    return header === `Bearer ${proxyToken}`;
}
