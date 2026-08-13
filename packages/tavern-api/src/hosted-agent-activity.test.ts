import { expect, test } from 'bun:test';
import {
    agentActivityCategorySchema,
    hostedAgentActivityEventSchema,
    hostedAgentActivityFrameSchema,
} from './hosted-agent-activity.ts';

const frame = {
    agentId: 'agt_one',
    category: 'using_tool',
    occurredAt: '2026-08-11T12:00:00.000Z',
    phase: 'started',
    producerSequence: 1,
    runId: 'run_one',
    type: 'agent-activity',
} as const;

test('activity categories are the safe semantic vocabulary', () => {
    expect(agentActivityCategorySchema.safeParse('running_command').success).toBe(true);
    expect(agentActivityCategorySchema.safeParse('drafting').success).toBe(false);
});

test('Computer frames reject detailed evidence and Server identity fields', () => {
    expect(hostedAgentActivityFrameSchema.parse(frame)).toEqual(frame);
    expect(
        hostedAgentActivityFrameSchema.safeParse({
            ...frame,
            command: 'cat private.txt',
        }).success
    ).toBe(false);
    expect(
        hostedAgentActivityFrameSchema.safeParse({
            ...frame,
            serverId: 'srv_wrong',
        }).success
    ).toBe(false);
});

test('committed events add Server identity and presentation position', () => {
    expect(
        hostedAgentActivityEventSchema.parse({
            agentId: frame.agentId,
            category: frame.category,
            occurredAt: frame.occurredAt,
            phase: frame.phase,
            producerSequence: frame.producerSequence,
            runId: frame.runId,
            id: 'aev_one',
            position: 3,
            producer: 'computer',
            producerId: 'cmp_one',
            serverId: 'srv_one',
        })
    ).toMatchObject({ position: 3, producer: 'computer', serverId: 'srv_one' });
});
