import * as z from 'zod';
import { agentTurnSchema } from './agent.ts';
import { idSchema } from './chat.ts';

/**
 * Turns any Agent on a Server started recently — the Server-wide read behind
 * "who has been working this week".
 *
 * Ranking Agents against each other is a question about the whole Server, so
 * it is one read rather than one read per Agent: a roster-sized fan-out of
 * per-Agent reads is what this contract exists to prevent.
 */
export const agentRecentTurnsWindowMaxDays = 30;

/**
 * The row ceiling for one window. A week of a busy Server is hundreds of
 * turns, not thousands, so the cap is a guard against a pathological Server
 * rather than a page size — a truncated window would silently under-rank the
 * Agents whose turns fell off the end, so the cap sits well above the real
 * shape of the data.
 */
export const agentRecentTurnsLimit = 2000;

export const agentRecentTurnsInputSchema = z
    .object({
        days: z.number().int().min(1).max(agentRecentTurnsWindowMaxDays).default(7),
        serverId: idSchema,
    })
    .strict();

export type AgentRecentTurnsInput = z.infer<typeof agentRecentTurnsInputSchema>;

/**
 * One recent turn, narrowed to what a cross-Agent ranking needs: whose turn it
 * was, when it ran, and how it ended. The evidence fields that settle a single
 * Agent's history — `outputProduced`, `failureKind`, `activity` — belong to
 * `agent.turns`, which reads one Agent on purpose.
 */
export const agentRecentTurnSchema = agentTurnSchema.pick({
    agentId: true,
    endedAt: true,
    runId: true,
    startedAt: true,
    status: true,
});

export type AgentRecentTurn = z.infer<typeof agentRecentTurnSchema>;

export const agentRecentTurnsSchema = z.array(agentRecentTurnSchema);
