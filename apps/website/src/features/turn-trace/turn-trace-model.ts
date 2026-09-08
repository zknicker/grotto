import type {
    AgentActivityCategory,
    AgentActivityEvent,
    AgentExecutionJournal,
    AgentExecutionJournalReasoning,
} from '@grotto/api';
import type { AgentActivityTurn } from '../members/agent-profile/agent-activity-turns.ts';
import { classifyTraceTool, type TurnTraceTool } from './turn-trace-tool-model.ts';

export type TurnTraceEntry =
    | {
          readonly at: string;
          readonly event: AgentActivityEvent;
          readonly key: string;
          readonly kind: 'event';
      }
    | {
          readonly at: string;
          readonly isStreaming: boolean;
          readonly key: string;
          readonly kind: 'reasoning';
          readonly reasoning: AgentExecutionJournalReasoning;
      }
    | {
          readonly at: string;
          readonly key: string;
          readonly kind: 'tool';
          readonly tool: TurnTraceTool;
      };

/**
 * Categories the execution journal describes in full. Keeping both would print
 * every command twice — once as a verb, once as the call it names.
 */
const journalCoveredCategories = new Set<AgentActivityCategory>([
    'browsing',
    'editing_files',
    'reading_files',
    'running_command',
    'searching_web',
    'using_tool',
]);

interface OrderedEntry {
    readonly entry: TurnTraceEntry;
    readonly sequence: number;
    readonly source: number;
    readonly time: number;
}

/**
 * One chronological column for a turn: the Server's semantic verbs, plus the
 * Computer's reasoning and tool calls when the journal is readable. Without a
 * journal the semantic events stand alone — product history never depends on
 * ephemeral execution evidence.
 */
export function buildTurnTrace(input: {
    journal: AgentExecutionJournal | null;
    turn: AgentActivityTurn | null;
}): TurnTraceEntry[] {
    const journal = input.journal;
    // A block the model opened but never filled — an abort before the first
    // delta, or redacted reasoning — is not something to render, and must not
    // stand in for the `thinking` verbs it would otherwise replace.
    const reasoning = (journal?.reasoning ?? []).filter((block) => block.text.length > 0);
    const events = (input.turn?.events ?? []).filter((event) =>
        journal ? isTraceEvent(event, reasoning.length > 0) : true
    );

    const ordered: OrderedEntry[] = events.map((event) => ({
        entry: { at: event.occurredAt, event, key: `event:${event.id}`, kind: 'event' },
        sequence: event.position,
        source: 0,
        time: Date.parse(event.occurredAt),
    }));

    for (const [index, block] of reasoning.entries()) {
        ordered.push({
            entry: {
                at: block.startedAt,
                isStreaming: !block.endedAt && journal?.status === 'running',
                key: `reasoning:${block.id}`,
                kind: 'reasoning',
                reasoning: block,
            },
            sequence: index,
            source: 1,
            time: Date.parse(block.startedAt),
        });
    }

    for (const [index, tool] of (journal?.tools ?? []).entries()) {
        ordered.push({
            entry: {
                at: tool.startedAt,
                key: `tool:${tool.toolCallId}`,
                kind: 'tool',
                tool: classifyTraceTool(tool),
            },
            sequence: index,
            source: 1,
            time: Date.parse(tool.startedAt),
        });
    }

    return ordered.sort(compareEntries).map((item) => item.entry);
}

function compareEntries(left: OrderedEntry, right: OrderedEntry): number {
    if (left.time !== right.time) {
        return left.time - right.time;
    }
    if (left.source !== right.source) {
        return left.source - right.source;
    }
    return left.sequence - right.sequence;
}

function isTraceEvent(event: AgentActivityEvent, dropsThinking: boolean): boolean {
    if (journalCoveredCategories.has(event.category)) {
        return false;
    }
    return !(dropsThinking && event.category === 'thinking');
}
