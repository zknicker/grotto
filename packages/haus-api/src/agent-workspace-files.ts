import * as z from 'zod';

/**
 * Bytes rather than execution: the bounded workspace path grammar, the skill
 * and workspace file projections, and the two request frames a Server sends a
 * Computer to read or write inside one Agent's workspace. Kept apart from the
 * attachment command frames, which carry turns.
 */

const idSchema = z.string().trim().min(1).max(200);
const timestampSchema = z.iso.datetime({ offset: true });

const agentSkillNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const agentSkillHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const agentSkillFileSchema = z
    .object({
        content: z.string().max(2 * 1024 * 1024),
        hash: agentSkillHashSchema,
        name: agentSkillNameSchema,
        updatedAt: timestampSchema,
    })
    .strict();

export type AgentSkillFile = z.infer<typeof agentSkillFileSchema>;

export const agentSkillFileRequestSchema = z
    .object({
        agentId: idSchema,
        operation: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('read'), name: agentSkillNameSchema }).strict(),
            z
                .object({
                    content: z.string().max(2 * 1024 * 1024),
                    expectedHash: agentSkillHashSchema,
                    kind: z.literal('update'),
                    name: agentSkillNameSchema,
                })
                .strict(),
            z
                .object({
                    expectedHash: agentSkillHashSchema,
                    kind: z.literal('delete'),
                    name: agentSkillNameSchema,
                })
                .strict(),
        ]),
        requestId: idSchema,
        type: z.literal('agent-skill-file-request'),
    })
    .strict();

export type AgentSkillFileRequest = z.infer<typeof agentSkillFileRequestSchema>;

export const workspacePathSchema = z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value.length === 0 || !value.startsWith('/'), {
        message: 'Workspace path must be relative.',
    })
    .refine((value) => !value.includes('\\'), {
        message: 'Workspace path must use forward slashes.',
    })
    .refine(
        (value) =>
            value.length === 0 ||
            value
                .split('/')
                .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
        { message: 'Workspace path must stay inside the workspace.' }
    );

export const workspaceFileEntrySchema = z
    .object({
        kind: z.enum(['directory', 'file']),
        mediaType: z.string().trim().min(1).nullable(),
        name: z.string().trim().min(1),
        path: workspacePathSchema.refine((value) => value.length > 0),
        sizeBytes: z.number().int().nonnegative().nullable(),
        updatedAt: timestampSchema.nullable(),
    })
    .strict();

export type WorkspaceFileEntry = z.infer<typeof workspaceFileEntrySchema>;

export const workspaceFileListSchema = z
    .object({
        entries: z.array(workspaceFileEntrySchema).max(10_000),
        path: workspacePathSchema,
        workspaceRoot: z.string().trim().min(1).max(4000),
    })
    .strict();

export type WorkspaceFileList = z.infer<typeof workspaceFileListSchema>;

export const workspaceFileContentSchema = z
    .object({
        binary: z.boolean(),
        content: z.string(),
        encoding: z.enum(['base64', 'utf8']),
        language: z.string().trim().min(1).nullable(),
        mediaType: z.string().trim().min(1),
        path: workspacePathSchema.refine((value) => value.length > 0),
        sizeBytes: z.number().int().nonnegative(),
        truncated: z.boolean(),
        updatedAt: timestampSchema.nullable(),
        workspaceRoot: z.string().trim().min(1).max(4000),
    })
    .strict();

export type WorkspaceFileContent = z.infer<typeof workspaceFileContentSchema>;

export const agentWorkspaceRequestSchema = z
    .object({
        agentId: idSchema,
        operation: z.discriminatedUnion('kind', [
            z
                .object({
                    includeHidden: z.boolean().optional().default(false),
                    kind: z.literal('list'),
                    path: workspacePathSchema,
                })
                .strict(),
            z
                .object({
                    includeHidden: z.boolean().optional().default(false),
                    kind: z.literal('read'),
                    path: workspacePathSchema.refine((value) => value.length > 0),
                })
                .strict(),
        ]),
        requestId: idSchema,
        type: z.literal('agent-workspace-request'),
    })
    .strict();

export type AgentWorkspaceRequest = z.infer<typeof agentWorkspaceRequestSchema>;
