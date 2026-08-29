export type GrottoUpdatePhase =
    | 'available'
    | 'blocked'
    | 'current'
    | 'failed'
    | 'restart-required'
    | 'updating';

export interface GrottoReleaseSnapshot {
    components: {
        agent: string | null;
        computer: string | null;
        desktopApp: string | null;
        ios: { buildNumber: number; version: string } | null;
        server: string | null;
    };
    sourceRevision: string;
    version: string;
}

export type GrottoUpdateComputerPhase =
    | 'available'
    | 'checking'
    | 'complete'
    | 'downloading'
    | 'failed'
    | 'idle'
    | 'installing'
    | 'offline'
    | 'requested'
    | 'restarting'
    | 'verifying'
    | 'waiting-for-agents';

export interface GrottoUpdateComputer {
    currentVersion: string | null;
    detail?: string | null;
    id: string;
    phase: GrottoUpdateComputerPhase;
    progress?: number | null;
}

export type GrottoUpdateDesktop =
    | { kind: 'web' }
    | {
          currentVersion: string | null;
          detail?: string | null;
          kind: 'desktop';
          phase:
              | 'available'
              | 'checking'
              | 'current'
              | 'downloading'
              | 'error'
              | 'idle'
              | 'ready'
              | 'restarting';
          progress?: number | null;
      };

export type GrottoUpdateStep = ComputerUpdateStep | DesktopUpdateStep;

export interface ComputerUpdateStep {
    currentVersion: string | null;
    detail: string | null;
    id: string;
    kind: 'computer';
    label: string;
    phase: GrottoUpdateComputerPhase | 'current';
    progress: number | null;
    targetVersion: string;
}

export interface DesktopUpdateStep {
    currentVersion: string | null;
    detail: string | null;
    id: 'desktop-app';
    kind: 'desktop-app';
    label: 'Grotto App';
    phase:
        | 'available'
        | 'checking'
        | 'current'
        | 'downloading'
        | 'failed'
        | 'pending'
        | 'restart-required'
        | 'restarting';
    progress: number | null;
    targetVersion: string;
}

export interface GrottoComponentFact {
    currentVersion: string | null;
    label: 'Agent' | 'Computer' | 'Grotto App' | 'iOS' | 'Server';
    status: 'current' | 'external' | 'managed' | 'pending';
    targetVersion: string | null;
}

export interface GrottoUpdateView {
    componentFacts: GrottoComponentFact[];
    detail: string;
    headline: string;
    phase: GrottoUpdatePhase;
    primaryAction:
        | { kind: 'restart'; label: 'Restart' }
        | { kind: 'retry'; label: 'Try again' }
        | { kind: 'start'; label: 'Update' }
        | null;
    steps: GrottoUpdateStep[];
    version: string;
}

export interface GrottoUpdateInput {
    computers: readonly GrottoUpdateComputer[];
    desktop: GrottoUpdateDesktop;
    release: GrottoReleaseSnapshot;
    runningAgentVersion: string | null;
    runningServerVersion: string | null;
}
