import assert from 'node:assert/strict';
import test from 'node:test';
import type {
    AgentActivityCategory,
    AgentActivityEvent,
    AgentActivityPhase,
    AgentExecutionJournal,
    AgentExecutionJournalTool,
} from '@haus/api';
import type { AgentActivityTurn } from '../members/agent-profile/agent-activity-turns.ts';
import { buildTurnTrace } from './turn-trace-model.ts';

test('buildTurnTrace interleaves reasoning, tools, and Server verbs by time', () => {
    const entries = buildTurnTrace({
        journal: journal({
            reasoning: [
                { id: 'think-1', startedAt: at(2), text: 'Plan the change.' },
                { id: 'think-2', startedAt: at(6), text: 'Check the result.' },
            ],
            tools: [
                tool({ startedAt: at(4), toolCallId: 'call-1' }),
                tool({ startedAt: at(8), toolCallId: 'call-2' }),
            ],
        }),
        turn: turn([
            event({ category: 'starting_work', occurredAt: at(1), position: 1 }),
            event({ category: 'sending_message', occurredAt: at(10), position: 2 }),
        ]),
    });

    assert.deepEqual(
        entries.map((entry) => entry.key),
        [
            'event:evt-1',
            'reasoning:think-1',
            'tool:call-1',
            'reasoning:think-2',
            'tool:call-2',
            'event:evt-2',
        ]
    );
});

test('buildTurnTrace drops the verbs the journal already describes', () => {
    const events = [
        event({ category: 'starting_work', occurredAt: at(1), position: 1 }),
        event({ category: 'running_command', occurredAt: at(2), position: 2 }),
        event({ category: 'thinking', occurredAt: at(3), position: 3 }),
        event({ category: 'checking_messages', occurredAt: at(4), position: 4 }),
        event({ category: 'working', occurredAt: at(5), phase: 'completed', position: 5 }),
    ];

    const merged = buildTurnTrace({
        journal: journal({
            reasoning: [{ id: 'think-1', startedAt: at(3), text: 'Deciding.' }],
            tools: [tool({ startedAt: at(2), toolCallId: 'call-1' })],
        }),
        turn: turn(events),
    });

    assert.deepEqual(
        merged.filter((entry) => entry.kind === 'event').map((entry) => entry.key),
        ['event:evt-1', 'event:evt-4', 'event:evt-5']
    );
});

test('buildTurnTrace keeps every semantic verb when no journal is readable', () => {
    const events = [
        event({ category: 'starting_work', occurredAt: at(1), position: 1 }),
        event({ category: 'running_command', occurredAt: at(2), position: 2 }),
        event({ category: 'thinking', occurredAt: at(3), position: 3 }),
    ];

    const merged = buildTurnTrace({ journal: null, turn: turn(events) });

    assert.equal(merged.length, 3);
    assert.ok(merged.every((entry) => entry.kind === 'event'));
});

test('buildTurnTrace marks unfinished reasoning as streaming only while the run is live', () => {
    const reasoning = [{ id: 'think-1', startedAt: at(1), text: 'Still going.', truncated: true }];

    const live = buildTurnTrace({
        journal: journal({ reasoning, status: 'running' }),
        turn: turn([]),
    })[0];
    const settled = buildTurnTrace({ journal: journal({ reasoning }), turn: turn([]) })[0];

    assert.equal(live?.kind === 'reasoning' && live.isStreaming, true);
    assert.equal(settled?.kind === 'reasoning' && settled.isStreaming, false);
    assert.equal(settled?.kind === 'reasoning' && settled.reasoning.truncated, true);
});

test('buildTurnTrace ignores a reasoning block the model opened but never filled', () => {
    const events = [
        event({ category: 'thinking', occurredAt: at(2), position: 1 }),
        event({ category: 'sending_message', occurredAt: at(4), position: 2 }),
    ];

    const entries = buildTurnTrace({
        journal: journal({ reasoning: [{ id: 'think-empty', startedAt: at(1), text: '' }] }),
        turn: turn(events),
    });

    assert.deepEqual(
        entries.map((entry) => entry.key),
        ['event:evt-1', 'event:evt-2']
    );
});

let eventCount = 0;

function at(seconds: number) {
    return new Date(Date.UTC(2026, 2, 31, 15, 0, seconds)).toISOString();
}

function event(overrides: {
    category: AgentActivityCategory;
    occurredAt: string;
    phase?: AgentActivityPhase;
    position: number;
}): AgentActivityEvent {
    eventCount += 1;
    return {
        agentId: 'agt_1',
        id: `evt-${overrides.position}`,
        phase: 'started',
        producer: 'server',
        producerId: 'srv_1',
        producerSequence: eventCount,
        runId: 'run_1',
        serverId: 'srv_1',
        ...overrides,
    };
}

function turn(events: AgentActivityEvent[]): AgentActivityTurn {
    return {
        durationMs: 10_000,
        endedAt: at(10),
        events,
        failureKind: null,
        kind: 'settled',
        messageCount: 1,
        operationCount: 1,
        operations: [],
        outputProduced: true,
        runId: 'run_1',
        startedAt: at(0),
        status: 'completed',
    };
}

function tool(overrides: Partial<AgentExecutionJournalTool> = {}): AgentExecutionJournalTool {
    return {
        startedAt: at(1),
        status: 'completed',
        toolCallId: 'call-1',
        toolName: 'bash',
        ...overrides,
    };
}

function journal(overrides: Partial<AgentExecutionJournal> = {}): AgentExecutionJournal {
    return {
        runId: 'run_1',
        startedAt: at(0),
        status: 'completed',
        tools: [],
        ...overrides,
    };
}
