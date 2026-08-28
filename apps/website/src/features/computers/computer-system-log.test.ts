import { expect, test } from 'bun:test';
import type { ComputerSystemEvent } from '@grotto/api';
import { hasFrequentDisconnects, systemEventLabel } from './computer-system-log.ts';

test('frequent disconnect warning appears only at five disconnects in five minutes', () => {
    const now = Date.parse('2026-08-28T12:05:00.000Z');
    expect(hasFrequentDisconnects(disconnects(4), now)).toBeFalse();
    expect(hasFrequentDisconnects(disconnects(5), now)).toBeTrue();
});

test('system events name Computer lifecycle and Server connection changes directly', () => {
    expect(
        systemEventLabel({
            id: 'cse_1234567890123456',
            occurredAt: '2026-08-28T12:00:00.000Z',
            type: 'connected',
        })
    ).toBe('Connected to Server');

    const commands = [
        ['start', 'Computer started'],
        ['stop', 'Computer stopped'],
        ['restart', 'Computer restarted'],
        ['upgrade', 'Computer upgraded'],
        ['rollback', 'Computer rolled back'],
    ] as const;

    expect(
        commands.map(([command], index) =>
            systemEventLabel({
                command,
                id: `cse_${String(index).padStart(16, '0')}`,
                occurredAt: '2026-08-28T12:00:00.000Z',
                type: 'management-command',
            })
        )
    ).toEqual(commands.map(([, event]) => event));

    expect(
        systemEventLabel({
            id: 'cse_1234567890123456',
            occurredAt: '2026-08-28T12:00:00.000Z',
            reason: 'socket-closed',
            type: 'disconnected',
        })
    ).toBe('Disconnected from Server');
});

function disconnects(count: number): ComputerSystemEvent[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `cse_${String(index).padStart(16, '0')}`,
        occurredAt: `2026-08-28T12:0${index}:00.000Z`,
        reason: 'socket-closed' as const,
        type: 'disconnected' as const,
    }));
}
