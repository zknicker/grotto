import type { ServerDetail } from '../../lib/grotto-server.tsx';

export type CoveOnboardingView =
    | 'app'
    | 'connect-computer'
    | 'connect-failed'
    | 'detecting-runtimes'
    | 'meet-cove'
    | 'applying-cove'
    | 'apply-failed';

/** Grotto Computer ships Apple Silicon macOS only; Windows stays visible but unselectable. */
export const coveComputerPlatforms = [
    { id: 'macos', isAvailable: true, label: 'macOS (Apple Silicon)' },
    { id: 'windows', isAvailable: false, label: 'Windows' },
] as const;

export interface CoveStatusLine {
    label: string;
    tone: 'done' | 'failed' | 'waiting';
}

type ServerOnboarding = ServerDetail['onboarding'];

/** Server-owned progress is the only authority for entering the general App. */
export function getCoveOnboardingView(onboarding: ServerOnboarding): CoveOnboardingView {
    if (onboarding.phase === 'complete') {
        return 'app';
    }
    if (onboarding.phase === 'awaiting-cove') {
        return 'meet-cove';
    }
    if (onboarding.phase === 'applying') {
        return onboarding.failure ? 'apply-failed' : 'applying-cove';
    }
    if (onboarding.failure) {
        return 'connect-failed';
    }
    return onboarding.computerId ? 'detecting-runtimes' : 'connect-computer';
}

export interface CoveRepairGuidance {
    /** Exact command to run on the Computer’s machine, when one repairs it. */
    command: string | null;
    /** Set when reconnection alone resumes setup with no App action. */
    note: string | null;
    remedy: string;
    title: string;
}

const reconnectResumesNote =
    'Setup continues automatically once the Computer reconnects — no need to press anything.';

/**
 * Human repair copy deliberately hides factory, seed, command, and
 * acknowledgement detail; each code maps to one precise operator action.
 */
export function getCoveRepairGuidance(
    failure: NonNullable<ServerOnboarding['failure']> | null
): CoveRepairGuidance {
    if (failure?.code === 'computer-disconnected') {
        return {
            command: 'grotto-computer start',
            note: reconnectResumesNote,
            remedy: 'Start Grotto Computer on the Mac it runs on.',
            title: 'This Computer is offline',
        };
    }
    if (failure?.code === 'computer-incompatible') {
        return {
            command: 'grotto-computer upgrade',
            note: reconnectResumesNote,
            remedy: 'Update Grotto Computer on the Mac it runs on.',
            title: 'Grotto Computer needs an update',
        };
    }
    if (failure?.code === 'inventory-empty') {
        return {
            command: null,
            note: reconnectResumesNote,
            remedy: 'Sign in to Codex or Claude Code on that Mac, then restart Grotto Computer.',
            title: 'No runtime is available on this Computer',
        };
    }
    if (failure?.code === 'inventory-invalid') {
        return {
            command: 'grotto-computer upgrade',
            note: reconnectResumesNote,
            remedy: 'Update Grotto Computer on the Mac it runs on.',
            title: 'This Computer needs an update before Cove can start',
        };
    }
    if (failure?.code === 'application-failed') {
        return {
            command: 'grotto-computer logs',
            note: null,
            remedy: 'Press Try again. If it fails again, check the Computer’s local logs on that Mac.',
            title: 'Cove’s setup didn’t finish',
        };
    }
    return {
        command: null,
        note: null,
        remedy: 'Make sure this Computer is connected, then try again.',
        title: 'Cove needs another try',
    };
}
