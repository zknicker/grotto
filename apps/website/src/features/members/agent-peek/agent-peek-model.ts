/**
 * The peek's pure copy: every summary line it renders, and the shapes that make
 * "we have none" and "we cannot say" different answers rather than one blank.
 */

import type { AgentActivityPhase } from '@haus/api';

/** Which Agent profile tab a peek section hands the reader to. */
export type AgentPeekTab = 'activity' | 'automations' | 'overview' | 'setup' | 'workspace';

/** What actually runs this Agent, as the peek's one execution line states it. */
export type AgentPeekExecution =
    | { kind: 'effective'; model: string; runtime: string }
    | { kind: 'unavailable'; label: string };

/** A name set rendered as a wrapped chip row, or the one line that stands in for it. */
export type AgentPeekNames =
    | { kind: 'empty'; label: string }
    | { kind: 'names'; names: readonly string[] };

/**
 * Only a running turn can truthfully be headed "Now". Anything settled is
 * history, so the section names itself for what it actually holds — and either
 * way it never restates the availability the header's chip already carries.
 */
export function agentPeekActivityTitle(latest: null | { phase: AgentActivityPhase }): string {
    return latest?.phase === 'started' ? 'Now' : 'Recent activity';
}

/**
 * The trailing clause of `Computer · runtime · model`. A pending or degraded
 * configuration says so in the same slot rather than leaving the line half
 * written.
 */
export function formatExecutionDetail(execution: AgentPeekExecution): string {
    return execution.kind === 'effective'
        ? `${execution.runtime} · ${execution.model}`
        : execution.label;
}

/**
 * Automations are one line: the wakes still coming and the Triggers still
 * armed. A kind with nothing in it is omitted rather than printed as zero, and
 * a peek with neither says so once.
 */
export function formatAutomationsSummary(counts: { reminders: number; triggers: number }): string {
    const parts = [
        formatCount(counts.reminders, 'reminder'),
        formatCount(counts.triggers, 'trigger'),
    ].filter((part): part is string => part !== null);

    return parts.length > 0 ? parts.join(' · ') : 'No automations';
}

/**
 * A Channel row says the Channel's name. A DM has none, so it says what it is —
 * never the peer's display name.
 */
export function formatPeekChatLabel(chat: { name: null | string }, agentHandle: string): string {
    return chat.name ?? `DM · @${agentHandle}`;
}

/**
 * Names for a wrapped chip row, deduplicated and ordered so the row is stable
 * between renders and scannable at the pane's narrowest measure.
 */
export function summarizeAgentNames(names: readonly string[], emptyLabel: string): AgentPeekNames {
    const unique = [...new Set(names)].sort((left, right) => left.localeCompare(right));

    return unique.length > 0
        ? { kind: 'names', names: unique }
        : { kind: 'empty', label: emptyLabel };
}

/**
 * Skills live in the assigned Computer's reported inventory, so an unreported
 * Computer means unknown rather than none. Saying "No skills yet" there would
 * invent a fact the Server never claimed.
 */
export function summarizeAgentSkills(input: {
    names: readonly string[];
    reported: boolean;
}): AgentPeekNames {
    if (!input.reported) {
        return { kind: 'empty', label: 'Unavailable while the Computer is offline.' };
    }

    return summarizeAgentNames(input.names, 'No skills yet.');
}

function formatCount(count: number, noun: string): null | string {
    if (count <= 0) {
        return null;
    }

    return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}
