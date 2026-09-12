import type { Agent } from '@haus/api';
import type { AgentUsageSummary } from '../../stats/agent-usage-summary.ts';

/**
 * One Agent's week as the "Active this week" strip reads it: the shape of its
 * last seven days of processed tokens, how many it burned in them, and whether
 * it is running now.
 */
export interface ActiveAgent {
    /** The step it is on right now, or null when it is between turns. */
    activityLabel: null | string;
    agent: Agent;
    /** Processed tokens per calendar day, oldest first — the sparkline's series. */
    days: number[];
    totalTokens: number;
}

/**
 * How many Agents the strip will carry. A Server can hold thirty-five Agents;
 * a strip of thirty-five cards is the wrapping grid this replaced, so the row
 * stops at the number a person can actually scan in one pass.
 */
export const activeAgentLimit = 8;

/** How much history a week card covers, in whole days. */
export const activeAgentWindowDays = 7;

/**
 * One card's numbers, from the Server's own usage snapshot.
 *
 * Tokens rather than turns: a turn is a unit of the execution runtime's
 * bookkeeping, and ten cheap turns and one long one read the same in a count.
 * Processed tokens are what the Agent actually spent, and they already have a
 * Server-wide read and a summarizer behind them.
 */
export function toActiveAgent(
    agent: Agent,
    usage: AgentUsageSummary,
    activityLabel: null | string
): ActiveAgent {
    return {
        activityLabel,
        agent,
        days: usage.points.map((point) => point.tokens),
        totalTokens: usage.totalTokens,
    };
}

/**
 * The Agents worth a card: the ones that actually did something this week, or
 * are doing something right now. Working Agents lead — a card that is moving is
 * the one a person wants first — then the busiest week, then the name, so the
 * order is stable when two Agents burned the same amount.
 *
 * An Agent that ran nothing and is running nothing has no week to show, so it
 * is not a quiet card in the strip; it is simply not in it.
 */
export function rankActiveAgents(
    entries: readonly ActiveAgent[],
    limit: number = activeAgentLimit
): ActiveAgent[] {
    return entries
        .filter((entry) => entry.totalTokens > 0 || entry.activityLabel !== null)
        .sort(
            (a, b) =>
                working(b) - working(a) ||
                b.totalTokens - a.totalTokens ||
                a.agent.displayName.localeCompare(b.agent.displayName)
        )
        .slice(0, limit);
}

/**
 * The line under a card's figure. A working Agent spends it on the step it is
 * on, which is the more perishable fact; every other card states what the
 * figure counts, because a bare number on a card is a riddle.
 */
export function activeAgentUnit(entry: Pick<ActiveAgent, 'activityLabel'>): string {
    return entry.activityLabel ?? `Tokens · ${activeAgentWindowDays}d`;
}

function working(entry: ActiveAgent): number {
    return entry.activityLabel === null ? 0 : 1;
}
