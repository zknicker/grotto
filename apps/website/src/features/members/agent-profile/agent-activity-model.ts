import type {
    AgentActivityCategory,
    AgentActivityEvent,
    AgentActivityPhase,
    AgentExecutionJournalResult,
} from '@tavern/api';

type ActivityCopy = Record<AgentActivityPhase, string>;

const activityCopy: Record<AgentActivityCategory, ActivityCopy> = {
    browsing: {
        completed: 'Browsed',
        failed: 'Failed while browsing',
        started: 'Browsing…',
    },
    checking_messages: {
        completed: 'Checked messages',
        failed: 'Failed to check messages',
        started: 'Checking messages…',
    },
    editing_files: {
        completed: 'Edited files',
        failed: 'Failed to edit files',
        started: 'Editing files…',
    },
    reading_files: {
        completed: 'Read files',
        failed: 'Failed to read files',
        started: 'Reading files…',
    },
    running_command: {
        completed: 'Ran a command',
        failed: 'Failed to run a command',
        started: 'Running a command…',
    },
    searching_web: {
        completed: 'Searched the web',
        failed: 'Failed to search the web',
        started: 'Searching the web…',
    },
    sending_message: {
        completed: 'Sent a message',
        failed: 'Failed to send a message',
        started: 'Sending a message…',
    },
    starting_work: {
        completed: 'Started work',
        failed: 'Failed to start work',
        started: 'Starting work…',
    },
    thinking: {
        completed: 'Thought',
        failed: 'Failed while thinking',
        started: 'Thinking…',
    },
    using_tool: {
        completed: 'Used a tool',
        failed: 'Failed while using a tool',
        started: 'Using a tool…',
    },
    working: {
        completed: 'Worked',
        failed: 'Failed while working',
        started: 'Working…',
    },
};

export type ActivityColor = 'danger' | 'success' | 'warning';

export function formatAgentActivityEvent(event: AgentActivityEvent): string {
    const copy = activityCopy[event.category][event.phase];
    if (event.category !== 'using_tool' || !event.toolRef) {
        return copy;
    }

    const toolCopy = {
        completed: `Used ${event.toolRef}`,
        failed: `Failed while using ${event.toolRef}`,
        started: `Using ${event.toolRef}…`,
    } satisfies ActivityCopy;

    return toolCopy[event.phase];
}

export function formatAgentActivityDiagnosticInfo(events: readonly AgentActivityEvent[]): string {
    return events
        .map((event) => `${event.occurredAt} · ${formatAgentActivityEvent(event)}`)
        .join('\n');
}

export function getAgentActivityColor(phase: AgentActivityPhase): ActivityColor {
    if (phase === 'failed') {
        return 'danger';
    }
    if (phase === 'started') {
        return 'warning';
    }
    return 'success';
}

export function getAgentActivityPhaseLabel(phase: AgentActivityPhase) {
    if (phase === 'failed') {
        return 'Failed';
    }
    if (phase === 'started') {
        return 'Active';
    }
    return 'Completed';
}

export type TurnJournalPresentation =
    | {
          description: string;
          kind: 'missing';
          title: string;
      }
    | {
          description: string;
          kind: 'offline';
          title: string;
      }
    | {
          description: string;
          kind: 'unavailable';
          reason: 'timeout';
          title: string;
      }
    | {
          description: string;
          kind: 'interrupted';
          title: string;
      }
    | {
          description: string;
          kind: 'redacted-by-source';
          title: string;
      }
    | {
          description: string;
          kind: 'empty';
          title: string;
      }
    | {
          journal: Extract<AgentExecutionJournalResult, { status: 'available' }>['journal'];
          kind: 'available';
      };

export function getTurnJournalPresentation(
    result: AgentExecutionJournalResult | null,
    requestedRunId: string | null
): TurnJournalPresentation {
    if (!(requestedRunId && result) || result.runId !== requestedRunId) {
        return {
            description: 'This message has no available Server turn identity.',
            kind: 'missing',
            title: 'Turn details unavailable',
        };
    }

    if (result.status === 'unavailable') {
        if (result.reason === 'missing') {
            return {
                description: 'The detailed execution record is no longer available.',
                kind: 'missing',
                title: 'Turn details unavailable',
            };
        }
        if (result.reason === 'offline') {
            return {
                description: 'The assigned Computer is offline. Try again when it is online.',
                kind: 'offline',
                title: 'Detailed activity unavailable offline',
            };
        }
        return {
            description: 'The Computer did not return detailed activity in time.',
            kind: 'unavailable',
            reason: 'timeout',
            title: 'Detailed activity unavailable',
        };
    }

    if (result.journal.status === 'interrupted') {
        return {
            description: 'The turn stopped before detailed execution finished.',
            kind: 'interrupted',
            title: 'Turn interrupted',
        };
    }

    if (result.journal.tools.length === 0) {
        return {
            description: 'No detailed tool activity was recorded for this turn.',
            kind: 'empty',
            title: 'No detailed activity',
        };
    }

    if (!result.journal.tools.some(hasSourceDetails)) {
        return {
            description: 'The source redacted detailed tool evidence for this turn.',
            kind: 'redacted-by-source',
            title: 'Details redacted by source',
        };
    }

    return { journal: result.journal, kind: 'available' };
}

export type TurnDetailAccess = 'journal' | 'summary';

export function shouldRequestExecutionJournal(input: {
    access: TurnDetailAccess;
    open: boolean;
    runId: string | null;
}): boolean {
    return input.open && input.access === 'journal' && input.runId !== null;
}

function hasSourceDetails(tool: {
    durationMs?: number;
    endedAt?: string;
    error?: unknown;
    final?: unknown;
    input?: unknown;
    interruptions?: readonly unknown[];
    nativeName?: string;
    output?: unknown;
    preliminary?: unknown;
}) {
    return Boolean(
        tool.durationMs !== undefined ||
            tool.endedAt ||
            tool.error !== undefined ||
            tool.final !== undefined ||
            tool.input !== undefined ||
            tool.interruptions?.length ||
            tool.nativeName ||
            tool.output !== undefined ||
            tool.preliminary !== undefined
    );
}
