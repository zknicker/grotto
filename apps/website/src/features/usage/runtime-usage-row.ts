import type { ComputerRuntimeId, UsageOverview } from '@haus/api';
import {
    type DisplayPlanWindow,
    selectFirstWindow,
    selectWindow,
    selectWindows,
} from './runtime-plan-windows.ts';

export interface RuntimeUsageRow {
    capturedAt: string | null;
    fiveHourWindow: DisplayPlanWindow | null;
    id: ComputerRuntimeId;
    status: string;
    title: string;
    window: DisplayPlanWindow | null;
}

export function buildRuntimeRow(
    id: ComputerRuntimeId,
    usage: UsageOverview,
    piAgentCount: number | null
): RuntimeUsageRow {
    const title = runtimeLabels[id];

    if (id === 'codex') {
        return {
            capturedAt: usage.codex.status === 'ok' ? usage.codex.snapshot.capturedAt : null,
            fiveHourWindow: null,
            id,
            status: 'Plan limits unavailable',
            title,
            window:
                usage.codex.status === 'ok'
                    ? selectFirstWindow(
                          usage.codex.snapshot.windows,
                          ['current-week', 'current-session'],
                          'Weekly Limit'
                      )
                    : null,
        };
    }

    if (id === 'claude-code') {
        return {
            capturedAt: usage.claude.status === 'ok' ? usage.claude.snapshot.capturedAt : null,
            fiveHourWindow:
                usage.claude.status === 'ok'
                    ? selectWindow(usage.claude.snapshot.windows, 'current-session', '5h')
                    : null,
            id,
            status: 'Plan limits unavailable',
            title,
            window:
                usage.claude.status === 'ok'
                    ? (selectWindows(usage.claude.snapshot.windows, [
                          ['current-week-all-models', 'Weekly Limit'],
                      ])[0] ?? null)
                    : null,
        };
    }

    if (id === 'grok-build') {
        return {
            capturedAt: usage.grok.status === 'ok' ? usage.grok.snapshot.capturedAt : null,
            fiveHourWindow: null,
            id,
            status: 'Weekly limit unavailable',
            title,
            window:
                usage.grok.status === 'ok'
                    ? (usage.grok.snapshot.windows.find(
                          (candidate) => candidate.label === 'Weekly Limit'
                      ) ?? null)
                    : null,
        };
    }

    return {
        capturedAt: null,
        fiveHourWindow: null,
        id,
        status: piAgentSummary(piAgentCount),
        title,
        window: null,
    };
}

export function staleUsageTimestamp(row: RuntimeUsageRow, now: number): string | null {
    if (!row.capturedAt) {
        return null;
    }
    const expiredWindow = [row.window, row.fiveHourWindow].some(
        (window) => window?.resetsAt && Date.parse(window.resetsAt) <= now
    );
    return now - Date.parse(row.capturedAt) >= 30 * 60_000 || expiredWindow ? row.capturedAt : null;
}

function piAgentSummary(agentCount: number | null) {
    if (agentCount === null) {
        return 'API-backed · Usage tracked automatically';
    }
    return agentCount === 0
        ? 'API-backed · No Agents using Pi'
        : `API-backed · ${agentCount} ${agentCount === 1 ? 'Agent' : 'Agents'}`;
}

export const runtimeOrder: ComputerRuntimeId[] = ['codex', 'claude-code', 'grok-build', 'pi'];

const runtimeLabels: Record<ComputerRuntimeId, string> = {
    'claude-code': 'Claude Code',
    codex: 'Codex',
    'grok-build': 'Grok Build',
    pi: 'Pi',
};
