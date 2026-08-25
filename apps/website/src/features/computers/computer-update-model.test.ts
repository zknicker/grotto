import { expect, test } from 'bun:test';
import type { ComputerUpdatePhase } from '@grotto/api';
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

test('an in-flight update keeps reporting its phase after the Computer drops', () => {
    // Restarting disconnects the Computer by design, so the offline label must
    // not swallow the progress the operator is watching.
    expect(computerUpdateView({ health: 'offline', phase: 'restarting' })).toMatchObject({
        label: 'Restarting Grotto Computer',
        needsLocalRecovery: false,
    });
    expect(computerUpdateView({ health: 'offline', phase: 'downloading' }).label).toBe(
        'Downloading Grotto Computer'
    );
});

test('an offline Computer explains itself instead of leaving the card silent', () => {
    // Offline disables both controls, so the label is the only thing the card can
    // render; it previously fell through to an empty action slot.
    expect(computerUpdateView({ health: 'offline', phase: 'idle' })).toMatchObject({
        canCheck: false,
        canUpdate: false,
        label: 'Unavailable while offline',
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

test('distinguishes a current-version check from a completed update', () => {
    expect(
        computerUpdateView({
            health: 'healthy',
            phase: 'idle',
            targetVersion: '1.1.5',
        })
    ).toMatchObject({
        canCheck: true,
        canUpdate: false,
        label: 'Up to date',
    });
    expect(
        computerUpdateView({
            health: 'healthy',
            phase: 'complete',
            targetVersion: '1.1.5',
        })
    ).toMatchObject({
        label: 'Update complete',
    });
});
