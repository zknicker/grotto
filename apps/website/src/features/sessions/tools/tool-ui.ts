export function formatToolStatusLabel(status: string) {
    const normalizedStatus = status.toLowerCase();

    if (
        normalizedStatus.includes('error') ||
        normalizedStatus.includes('forbidden') ||
        normalizedStatus.includes('failed') ||
        normalizedStatus.includes('timeout') ||
        normalizedStatus.includes('timed out')
    ) {
        return 'Failed';
    }

    if (normalizedStatus === 'ok') {
        return 'OK';
    }

    if (isActiveToolStatus(status)) {
        return 'Running';
    }

    return status;
}

export function isActiveToolStatus(status: string | null) {
    if (!status) {
        return false;
    }

    const normalizedStatus = status.toLowerCase();
    return ['active', 'in_progress', 'pending', 'running', 'started'].includes(normalizedStatus);
}

export function shouldShowToolStatusBadge(input: {
    completedAt: string | null;
    status: string | null;
}) {
    if (!input.status) {
        return false;
    }

    return !(input.completedAt && isActiveToolStatus(input.status));
}

export function hasErrorStatus(status: string | null) {
    if (!status) {
        return false;
    }

    const normalizedStatus = status.toLowerCase();
    return (
        normalizedStatus.includes('error') ||
        normalizedStatus.includes('forbidden') ||
        normalizedStatus.includes('failed') ||
        normalizedStatus.includes('timeout') ||
        normalizedStatus.includes('timed out')
    );
}

export function formatToolDuration(startedAt: string | null, completedAt: string | null) {
    if (!(startedAt && completedAt)) {
        return null;
    }

    const startedAtValue = Date.parse(startedAt);
    const completedAtValue = Date.parse(completedAt);

    if (Number.isNaN(startedAtValue) || Number.isNaN(completedAtValue)) {
        return null;
    }

    const durationMs = Math.max(0, completedAtValue - startedAtValue);

    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    if (durationMs < 60_000) {
        return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
    }

    const durationMinutes = Math.floor(durationMs / 60_000);
    const remainingSeconds = Math.round((durationMs % 60_000) / 1000);

    if (remainingSeconds === 60) {
        return `${durationMinutes + 1}m`;
    }

    if (remainingSeconds === 0) {
        return `${durationMinutes}m`;
    }

    return `${durationMinutes}m ${remainingSeconds}s`;
}
