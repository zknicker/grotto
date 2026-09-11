import type { Agent, AgentRecentTurn, AgentTurn } from '@grotto/api';
import { agentTurnDays, agentTurnWindowDays } from './agent-turn-days.ts';

/**
 * One Agent's week as the "Active this week" strip reads it: the shape of its
 * last seven days, how much it ran in them, and whether it is running now.
 */
export interface ActiveAgent {
    /** The step it is on right now, or null when it is between turns. */
    activityLabel: null | string;
    agent: Agent;
    /** Turns per calendar day, oldest first — the sparkline's series. */
    days: number[];
    turnCount: number;
}

/**
 * How many Agents the strip will carry. A Server can hold thirty-five Agents;
 * a strip of thirty-five cards is the wrapping grid this replaced, so the row
 * stops at the number a person can actually scan in one pass.
 */
export const activeAgentLimit = 8;

export function toActiveAgent(
    agent: Agent,
    turns: readonly Pick<AgentTurn, 'startedAt'>[] | undefined,
    activityLabel: null | string,
    now: number
): ActiveAgent {
    const days = agentTurnDays(turns, now);

    return {
        activityLabel,
        agent,
        days,
        turnCount: days.reduce((total, count) => total + count, 0),
    };
}

/**
 * The Server's recent turns, split by whose they were.
 *
 * The Server answers "who ran lately" in one read across every Agent, so the
 * split back into per-Agent weeks happens here rather than in the query. An
 * Agent with no turns in the window is simply absent from the map, which is
 * the same thing `toActiveAgent` reads as an empty week.
 */
export function groupTurnsByAgent(
    turns: readonly AgentRecentTurn[]
): ReadonlyMap<string, readonly AgentRecentTurn[]> {
    const byAgent = new Map<string, AgentRecentTurn[]>();

    for (const turn of turns) {
        const existing = byAgent.get(turn.agentId);
        if (existing) {
            existing.push(turn);
        } else {
            byAgent.set(turn.agentId, [turn]);
        }
    }

    return byAgent;
}

/**
 * The Agents worth a card: the ones that actually did something this week, or
 * are doing something right now. Working Agents lead — a card that is moving is
 * the one a person wants first — then the busiest week, then the name, so the
 * order is stable when two Agents ran the same amount.
 *
 * An Agent that ran nothing and is running nothing has no week to show, so it
 * is not a quiet card in the strip; it is simply not in it.
 */
export function rankActiveAgents(
    entries: readonly ActiveAgent[],
    limit: number = activeAgentLimit
): ActiveAgent[] {
    return entries
        .filter((entry) => entry.turnCount > 0 || entry.activityLabel !== null)
        .sort(
            (a, b) =>
                working(b) - working(a) ||
                b.turnCount - a.turnCount ||
                a.agent.displayName.localeCompare(b.agent.displayName)
        )
        .slice(0, limit);
}

/**
 * The line under a card's figure. A working Agent spends it on the step it is
 * on, which is the more perishable fact; every other card states what the
 * figure counts, because a bare number on a card is a riddle.
 */
export function activeAgentUnit(entry: Pick<ActiveAgent, 'activityLabel' | 'turnCount'>): string {
    if (entry.activityLabel) {
        return entry.activityLabel;
    }
    return `${entry.turnCount === 1 ? 'turn' : 'turns'} · ${agentTurnWindowDays}d`;
}

function working(entry: ActiveAgent): number {
    return entry.activityLabel === null ? 0 : 1;
}
