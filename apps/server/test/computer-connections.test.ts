import { expect, test } from 'bun:test';
import type { HostedAgentCommand, SignedComputerRelease } from '@tavern/api';
import { ComputerConnections } from '../src/computers/connections.ts';

const computerId = 'cmp_1234567890123456';
const start: HostedAgentCommand = {
    agentId: 'agt_1234567890123456',
    chatId: 'cht_1234567890123456',
    modelId: 'model',
    prompt: 'work',
    runId: 'run_1234567890123456',
    runtimeId: 'runtime',
    type: 'start',
};
const stop: HostedAgentCommand = {
    agentId: start.agentId,
    runId: start.runId,
    type: 'stop',
};
const release = {
    release: {
        sha256: 'a'.repeat(64),
        tarballUrl: 'https://releases.grotto.sh/computer.tgz',
        version: '1.1.0',
    },
    signature: 's'.repeat(64),
} satisfies SignedComputerRelease;

test('update-required permits signed update control but rejects ordinary work', () => {
    const frames: unknown[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: false,
        send: (frame) => frames.push(frame),
        serverId: 'srv_1234567890123456',
        updatePhase: 'idle',
    });

    expect(connections.send(computerId, start)).toBe(false);
    expect(connections.sendUpdate(computerId, release)).toBe(true);
    expect(frames).toEqual([{ release, type: 'update' }]);
});

test('waiting for Agents closes admission until reconnect completes', () => {
    const frames: unknown[] = [];
    const connections = new ComputerConnections();
    connections.register(computerId, {
        ordinary: true,
        send: (frame) => frames.push(frame),
        serverId: 'srv_1234567890123456',
        updatePhase: 'installing',
    });
    expect(connections.send(computerId, start)).toBe(true);

    connections.setUpdatePhase(computerId, 'waiting-for-agents');
    expect(connections.send(computerId, start)).toBe(false);
    expect(connections.send(computerId, stop)).toBe(true);

    connections.setUpdatePhase(computerId, 'complete');
    expect(connections.send(computerId, start)).toBe(true);
    expect(frames).toEqual([start, stop, start]);
});
