import * as z from 'zod';

/** Human-selected reasoning policy for one Agent's desired execution config. */
export const agentReasoningEffortSchema = z.enum(['low', 'medium', 'high']);

export type AgentReasoningEffort = z.infer<typeof agentReasoningEffortSchema>;
