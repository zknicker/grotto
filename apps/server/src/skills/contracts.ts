import { agentRuntimeSkillHubTapSchema, agentRuntimeSkillRequirementsSchema } from '@tavern/api';
import * as z from 'zod';

export const skillIdSchema = z.string().trim().min(1).max(200);

export const skillHubIdentifierInputSchema = z.object({
    identifier: z.string().trim().min(1).max(400),
});

export const skillHubInstallInputSchema = skillHubIdentifierInputSchema.extend({
    force: z.boolean().optional(),
});

export const skillResetInputSchema = z.object({
    skillId: skillIdSchema,
});

export const skillHubUninstallInputSchema = z.object({
    name: z.string().trim().min(1).max(200),
});

export const skillHubTapInputSchema = agentRuntimeSkillHubTapSchema;

export const skillHubTapRemoveInputSchema = z.object({
    repo: z.string().trim().min(1).max(200),
});

export const toolIdInputSchema = z.object({
    toolId: skillIdSchema,
});

export const toolProviderSelectInputSchema = z.object({
    provider: z.string().trim().min(1).max(100),
    toolId: skillIdSchema,
});

export const toolEnvSaveInputSchema = z.object({
    env: z.record(z.string().trim().min(1), z.string().max(4000)),
    toolId: skillIdSchema,
});

export const toolPostSetupInputSchema = z.object({
    key: z.string().trim().min(1).max(100),
    toolId: skillIdSchema,
});

export const setSkillEnabledInputSchema = z.object({
    enabled: z.boolean(),
    skillId: skillIdSchema,
});

export const setToolEnabledInputSchema = z.object({
    enabled: z.boolean(),
    toolId: skillIdSchema,
});

export const skillDependencyStateSchema = z.enum(['missing', 'ready', 'unknown']);
export const skillPluginUsabilitySchema = z.enum(['disabled', 'enabled', 'not_usable']);
export const skillRuntimeSurfaceSchema = z.literal('agent');

export const skillSummarySchema = z.object({
    allowedTools: z.string().nullable(),
    description: z.string().nullable(),
    id: z.string().min(1),
    name: z.string().min(1),
    diagnostic: z.string().nullable(),
    dependencyState: skillDependencyStateSchema,
    enabled: z.boolean(),
    missing: agentRuntimeSkillRequirementsSchema,
    readOnly: z.boolean(),
    surface: skillRuntimeSurfaceSchema,
    updatedAt: z.string().datetime().nullable(),
    usability: skillPluginUsabilitySchema,
    version: z.string().min(1).nullable(),
});

export const toolSummarySchema = z.object({
    configured: z.boolean(),
    description: z.string().nullable(),
    diagnostic: z.string().nullable(),
    enabled: z.boolean(),
    id: z.string().min(1),
    name: z.string().min(1),
    readOnly: z.boolean(),
    tools: z.array(z.string().min(1)),
    usability: skillPluginUsabilitySchema,
});

export const skillListSchema = z.object({
    skills: z.array(skillSummarySchema),
    tools: z.array(toolSummarySchema),
});

export type SkillList = z.infer<typeof skillListSchema>;
export type SkillSummary = z.infer<typeof skillSummarySchema>;
export type ToolSummary = z.infer<typeof toolSummarySchema>;
