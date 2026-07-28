import { expect, test } from 'bun:test';
import type { ComputerUpdatePhase } from '@tavern/api';
import { computerUpdateView } from './computer-update-model.ts';

test('presents every Computer update phase', () => {
    const phases: ComputerUpdatePhase[] = [
        'idle',
        'checking',
        'available',
        'requested',
        'downloading',
        'verifying',
        'installing',
        'waiting-for-agents',
        'restarting',
        'complete',
        'failed',
    ];
    expect(phases.map((phase) => computerUpdateView({ health: 'healthy', phase }).label)).toEqual([
        'Not checked',
        'Checking production release…',
        'Update available',
        'Download requested',
        'Downloading Grotto Computer',
        'Verifying signature and integrity',
        'Installing update',
        'Waiting for active Agents…',
        'Restarting Grotto Computer',
        'Update complete',
        'Update failed',
    ]);
});

test('keeps signed update available in update-required and disables ordinary offline state', () => {
    expect(computerUpdateView({ health: 'update-required', phase: 'available' })).toMatchObject({
        canCheck: true,
        canUpdate: true,
        needsLocalRecovery: true,
    });
    expect(computerUpdateView({ health: 'offline', phase: 'available' })).toMatchObject({
        canCheck: false,
        canUpdate: false,
        needsLocalRecovery: true,
    });
});

test('shows checking immediately while a Settings mutation is pending', () => {
    expect(
        computerUpdateView({ health: 'healthy', isChecking: true, phase: 'idle' })
    ).toMatchObject({
        canCheck: false,
        canUpdate: false,
        label: 'Checking production release…',
    });
});
