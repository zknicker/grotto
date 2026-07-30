import {
    agentRuntimeWorkspaceFileListInputSchema,
    agentRuntimeWorkspaceFilePathSchema,
} from '@tavern/api';
import { z } from 'zod';
import { createAgentRuntimeClientForConnection } from '../../agent-runtime/client-factory.ts';
import { getAgent } from '../../agents/catalog.ts';
import { getAgentRuntimeConnection } from '../../storage/agent-runtime-connections.ts';
import { emitAgentInstructionsUpdated } from '../invalidation-events.ts';
import { publicProcedure } from '../trpc.ts';

const editableWorkspaceFileSchema = z.enum(['NOTES.md', 'SOUL.md']);

const agentWorkspaceFileInputSchema = z.object({
    agentId: z.string().trim().min(1),
    path: editableWorkspaceFileSchema,
});

const saveAgentWorkspaceFileInputSchema = agentWorkspaceFileInputSchema.extend({
    content: z.string(),
});

const agentWorkspaceFileListInputSchema = z.object({
    agentId: z.string().trim().min(1),
    includeHidden: agentRuntimeWorkspaceFileListInputSchema.shape.includeHidden,
    path: agentRuntimeWorkspaceFileListInputSchema.shape.path.optional().default(''),
});

const agentWorkspaceReadableFileInputSchema = z.object({
    agentId: z.string().trim().min(1),
    includeHidden: z.boolean().optional().default(false),
    path: agentRuntimeWorkspaceFilePathSchema.refine((value) => value.length > 0, {
        message: 'Workspace file path is required.',
    }),
});

export const getAgentWorkspaceFile = publicProcedure
    .input(agentWorkspaceFileInputSchema)
    .query(async ({ input }) => {
        const client = await createClientForAgent(input.agentId);

        try {
            return await client.getAgentFile(input.agentId, input.path);
        } finally {
            client.close();
        }
    });

export const saveAgentWorkspaceFile = publicProcedure
    .input(saveAgentWorkspaceFileInputSchema)
    .mutation(async ({ input }) => {
        const client = await createClientForAgent(input.agentId);

        try {
            const file = await client.saveAgentFile(input.agentId, input.path, {
                content: input.content,
            });
            emitAgentInstructionsUpdated({ agentId: input.agentId });
            return file;
        } finally {
            client.close();
        }
    });

export const listAgentWorkspaceFiles = publicProcedure
    .input(agentWorkspaceFileListInputSchema)
    .query(async ({ input }) => {
        const client = await createClientForAgent(input.agentId);

        try {
            return await client.listWorkspaceFiles(input.agentId, {
                includeHidden: input.includeHidden,
                path: input.path,
            });
        } finally {
            client.close();
        }
    });

export const getAgentWorkspaceReadableFile = publicProcedure
    .input(agentWorkspaceReadableFileInputSchema)
    .query(async ({ input }) => {
        const client = await createClientForAgent(input.agentId);

        try {
            return await client.getWorkspaceFile(input.agentId, input.path, input.includeHidden);
        } finally {
            client.close();
        }
    });

async function createClientForAgent(agentId: string) {
    const agent = await getAgent(agentId);
    if (!agent) {
        throw new Error(`No agent named "${agentId}" exists.`);
    }

    const connection = await getAgentRuntimeConnection(agent.runtimeId);
    if (!connection?.enabled) {
        throw new Error(`No enabled Grotto Runtime connection named "${agent.runtimeId}" exists.`);
    }

    return createAgentRuntimeClientForConnection(connection);
}
