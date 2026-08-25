import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
    type DesktopUpdateBridgeStatus,
    getDesktopBridge,
    isElectronDesktopApp,
} from '../../lib/desktop-bridge.ts';

export type DesktopUpdateStatus =
    | { phase: 'unsupported' }
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'current' }
    | { phase: 'available'; version: string }
    | { phase: 'downloading'; progress: number; version: string }
    | { phase: 'ready'; version: string }
    | { phase: 'restarting'; version: string }
    | { phase: 'error'; message: string };

let currentStatus: DesktopUpdateStatus = isElectronDesktopApp()
    ? { phase: 'idle' }
    : { phase: 'unsupported' };
let monitorStarted = false;
let activeTask: Promise<void> | null = null;

const listeners = new Set<() => void>();

export function useDesktopUpdate() {
    const status = useSyncExternalStore(subscribeDesktopUpdate, getDesktopUpdateSnapshot);

    useEffect(() => {
        startDesktopUpdateMonitor();
    }, []);

    const checkForUpdate = useCallback(async () => {
        await checkForDesktopUpdate({ install: false });
    }, []);

    const updateAndRestart = useCallback(async () => {
        await installDesktopUpdateAndRestart();
    }, []);

    return {
        checkForUpdate,
        status,
        updateAndRestart,
    };
}

function startDesktopUpdateMonitor() {
    const bridge = getDesktopBridge();

    if (monitorStarted || !bridge) {
        return;
    }

    monitorStarted = true;
    bridge.onUpdateStatus((status) => {
        setDesktopUpdateStatus(
            reconcileDesktopUpdateStatus(currentStatus, fromBridgeStatus(status))
        );
    });
    void checkForDesktopUpdate({ install: false });
}

function subscribeDesktopUpdate(listener: () => void) {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

function getDesktopUpdateSnapshot() {
    return currentStatus;
}

function setDesktopUpdateStatus(status: DesktopUpdateStatus) {
    currentStatus = status;

    for (const listener of listeners) {
        listener();
    }
}

async function checkForDesktopUpdate({ install }: { install: boolean }) {
    const bridge = getDesktopBridge();

    if (!bridge) {
        setDesktopUpdateStatus({ phase: 'unsupported' });
        return;
    }

    if (isPersistentUpdateStatus(currentStatus)) {
        return;
    }

    if (activeTask) {
        await activeTask;
        return;
    }

    setDesktopUpdateStatus({ phase: 'checking' });

    activeTask = checkForDesktopUpdateTask({ install }).finally(() => {
        activeTask = null;
    });

    await activeTask;
}

async function checkForDesktopUpdateTask({ install }: { install: boolean }) {
    const bridge = getDesktopBridge();

    if (!bridge) {
        setDesktopUpdateStatus({ phase: 'unsupported' });
        return;
    }

    try {
        await bridge.checkForUpdate();

        if (install) {
            await installCurrentDesktopUpdate({
                unavailableMessage: 'No Grotto update is available to install.',
            });
        }
    } catch (error) {
        setDesktopUpdateStatus({
            phase: 'error',
            message: getErrorMessage(error, 'Grotto could not check for updates.'),
        });
    }
}

async function installDesktopUpdateAndRestart() {
    const bridge = getDesktopBridge();

    if (!bridge) {
        setDesktopUpdateStatus({ phase: 'unsupported' });
        return;
    }

    if (currentStatus.phase === 'available' || currentStatus.phase === 'ready') {
        await installCurrentDesktopUpdate({
            unavailableMessage: 'No Grotto update is available to install.',
        });
        return;
    }

    await checkForDesktopUpdate({ install: true });
}

async function installCurrentDesktopUpdate(options?: { unavailableMessage?: string }) {
    const bridge = getDesktopBridge();

    if (!bridge) {
        setDesktopUpdateStatus({ phase: 'unsupported' });
        return;
    }

    if (currentStatus.phase === 'ready') {
        setDesktopUpdateStatus({ phase: 'restarting', version: currentStatus.version });
        await bridge.restartForUpdate();
        return;
    }

    if (currentStatus.phase !== 'available') {
        if (options?.unavailableMessage) {
            setDesktopUpdateStatus({
                message: options.unavailableMessage,
                phase: 'error',
            });
        }
        return;
    }

    const version = currentStatus.version;
    setDesktopUpdateStatus({ phase: 'downloading', progress: 0, version });

    try {
        await bridge.downloadUpdate();
    } catch (error) {
        setDesktopUpdateStatus({
            phase: 'error',
            message: getErrorMessage(error, 'Grotto could not install the update.'),
        });
    }
}

export function isPersistentUpdateStatus(status: DesktopUpdateStatus) {
    return (
        status.phase === 'available' ||
        status.phase === 'downloading' ||
        status.phase === 'ready' ||
        status.phase === 'restarting'
    );
}

export function canCheckForDesktopUpdate(status: DesktopUpdateStatus) {
    return status.phase === 'idle' || status.phase === 'current' || status.phase === 'error';
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error) {
        return error;
    }

    return fallback;
}

function fromBridgeStatus(status: DesktopUpdateBridgeStatus): DesktopUpdateStatus {
    return status;
}

export function reconcileDesktopUpdateStatus(
    current: DesktopUpdateStatus,
    incoming: DesktopUpdateStatus
): DesktopUpdateStatus {
    if (current.phase === 'downloading' && incoming.phase === 'downloading') {
        return { ...incoming, version: current.version };
    }

    return incoming;
}
