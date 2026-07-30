import {
    agentRuntimeWorkspaceFileContentSchema,
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFileListSchema,
} from '@tavern/api';
import { getDb } from '../db/connection';
import { json } from '../tavern/http';
import { seedDevelopmentWorkspaceDemos } from './development-demos';
import { listWorkspaceFiles, readWorkspaceFile } from './files';
import {
    generateAgentInstructions,
    readRenderedAgentInstructions,
    registerAgentWorkspace,
} from './instructions';

export async function handleWorkspaceRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (segments[0] !== 'workspace' || segments[1] !== 'agents' || !segments[2]) {
        return null;
    }

    const agentId = segments[2];

    if (request.method === 'GET' && segments[3] === 'instructions') {
        const rendered = await readRenderedAgentInstructions(getDb(), agentId);
        return json(rendered);
    }

    if (request.method === 'GET' && segments[3] === 'files' && !segments[4]) {
        const input = agentRuntimeWorkspaceFileListInputSchema.parse({
            includeHidden: url.searchParams.get('includeHidden') === 'true',
            path: url.searchParams.get('path') ?? '',
        });
        return json(
            agentRuntimeWorkspaceFileListSchema.parse(
                await listWorkspaceFiles(getDb(), {
                    agentId,
                    includeHidden: input.includeHidden,
                    path: input.path,
                })
            )
        );
    }

    if (request.method === 'GET' && segments[3] === 'files' && segments[4]) {
        return json(
            agentRuntimeWorkspaceFileContentSchema.parse(
                await readWorkspaceFile(getDb(), {
                    agentId,
                    includeHidden: url.searchParams.get('includeHidden') === 'true',
                    path: segments[4],
                })
            )
        );
    }

    if (request.method === 'PUT' && segments[3] === 'instructions') {
        const body = await readJson(request);
        const source = registerAgentWorkspace(getDb(), {
            agentId,
            agentName: readOptionalString(body.agentName),
            workspaceDir: readString(body.workspaceDir, 'workspaceDir'),
        });
        const generated = await generateAgentInstructions(getDb(), agentId);
        await seedDevelopmentWorkspaceDemos({ sources: [source] });

        return json({
            agentId: source.agentId,
            renderedAt: generated.renderedAt,
            sha256: generated.sha256,
            updatedAt: source.updatedAt,
        });
    }

    return null;
}

async function readJson(request: Request) {
    const body = await request.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

function readString(value: unknown, label: string) {
    const text = readOptionalString(value);
    if (!text) {
        throw new Error(`${label} is required.`);
    }
    return text;
}

function readOptionalString(value: unknown) {
    return typeof value === 'string' ? value.trim() : null;
}
