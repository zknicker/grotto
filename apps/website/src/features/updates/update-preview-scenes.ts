import type {
    GrottoReleaseSnapshot,
    GrottoUpdateComputer,
    GrottoUpdateDesktop,
    GrottoUpdateInput,
    GrottoUpdateView,
} from './grotto-update-model.ts';
import { projectGrottoUpdate } from './grotto-update-model.ts';
import type { OfflineComputerNotice } from './use-offline-computers.ts';

export const updatePreviewBasePath = '/prototype/updates';

export interface UpdatePreviewScene {
    description: string;
    group: 'Available' | 'Blocked' | 'Current' | 'Desktop' | 'In progress';
    id: string;
    offlineComputers: readonly OfflineComputerNotice[];
    view: GrottoUpdateView;
}

const release: GrottoReleaseSnapshot = {
    components: {
        agent: '1.1.0',
        computer: '1.4.9',
        desktopApp: '1.8.40',
        ios: { buildNumber: 6, version: '1.0.5' },
        server: '1.8.38',
    },
    sourceRevision: 'a'.repeat(40),
    version: '1.9.0',
};

const currentComputer = computer({ currentVersion: '1.4.9', phase: 'idle' });
const currentDesktop: GrottoUpdateDesktop = {
    currentVersion: '1.8.40',
    kind: 'desktop',
    phase: 'current',
};

export const updatePreviewScenes: UpdatePreviewScene[] = [
    previewScene({
        description: 'Every selected component matches Grotto 1.9.0.',
        group: 'Current',
        id: 'current-desktop',
    }),
    previewScene({
        description: 'The web can inspect and update Computers without a local App step.',
        desktop: { kind: 'web' },
        group: 'Current',
        id: 'current-web',
    }),
    previewScene({
        computers: [
            computer({ id: 'cmp_a', name: "Zach's MacBook Pro" }),
            computer({ id: 'cmp_b', name: 'Office' }),
        ],
        description: 'Two Computers update before the local Grotto App.',
        desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        group: 'Available',
        id: 'multiple-updates',
    }),
    previewScene({
        computers: [computer({ phase: 'downloading', progress: 0.42 })],
        description: 'The first Computer is downloading with determinate progress.',
        desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'available' },
        group: 'In progress',
        id: 'computer-downloading',
    }),
    previewScene({
        computers: [
            computer({
                detail: 'Waiting for 2 active Agents to finish.',
                phase: 'waiting-for-agents',
            }),
        ],
        description: 'Active Agent work drains before Computer installation.',
        group: 'In progress',
        id: 'waiting-for-agents',
    }),
    previewScene({
        computers: [computer({ phase: 'restarting' })],
        description: 'A Computer disconnects while restarting and remains the active step.',
        group: 'In progress',
        id: 'computer-restarting',
    }),
    previewScene({
        description: 'All Computers are current, so the local App downloads next.',
        desktop: {
            currentVersion: '1.8.39',
            kind: 'desktop',
            phase: 'downloading',
            progress: 0.68,
        },
        group: 'Desktop',
        id: 'desktop-downloading',
    }),
    previewScene({
        description: 'The signed App update is ready for an explicit restart.',
        desktop: { currentVersion: '1.8.39', kind: 'desktop', phase: 'ready' },
        group: 'Desktop',
        id: 'restart-required',
    }),
    previewScene({
        computers: [computer({ health: 'offline', phase: 'idle' })],
        description: 'An offline Computer has its own delayed connectivity notice.',
        group: 'Blocked',
        id: 'computer-offline',
        offlineComputers: [
            {
                id: 'cmp_studio',
                lastConnectedAt: '2026-08-29T15:00:00.000Z',
                name: 'Home',
            },
        ],
    }),
    previewScene({
        computers: [computer({ detail: 'Signature verification failed.', phase: 'failed' })],
        description: 'A Computer failure keeps completed work and offers retry.',
        group: 'Blocked',
        id: 'computer-failed',
    }),
    previewScene({
        description: 'Computer work is complete and only the App download needs retry.',
        desktop: {
            currentVersion: '1.8.39',
            detail: 'The update server could not be reached.',
            kind: 'desktop',
            phase: 'error',
        },
        group: 'Blocked',
        id: 'desktop-failed',
    }),
    previewScene({
        description: 'One public release contains independent component versions.',
        group: 'Current',
        id: 'independent-versions',
        release: {
            ...release,
            components: {
                agent: '1.3.1',
                computer: '2.4.7',
                desktopApp: '3.2.1',
                ios: { buildNumber: 42, version: '4.0.2' },
                server: '5.1.6',
            },
            version: '6.0.0',
        },
        computers: [computer({ currentVersion: '2.4.7', phase: 'idle' })],
        desktop: { currentVersion: '3.2.1', kind: 'desktop', phase: 'current' },
    }),
];

export function updatePreviewScenePath(scene: UpdatePreviewScene) {
    return `${updatePreviewBasePath}/${scene.id}`;
}

export function findUpdatePreviewScene(sceneId: string) {
    return updatePreviewScenes.find((scene) => scene.id === sceneId) ?? null;
}

function previewScene(
    options: Partial<GrottoUpdateInput> &
        Pick<UpdatePreviewScene, 'description' | 'group' | 'id'> &
        Partial<Pick<UpdatePreviewScene, 'offlineComputers'>>
): UpdatePreviewScene {
    const input: GrottoUpdateInput = {
        computers: options.computers ?? [currentComputer],
        desktop: options.desktop ?? currentDesktop,
        release: options.release ?? release,
    };
    return {
        description: options.description,
        group: options.group,
        id: options.id,
        offlineComputers: options.offlineComputers ?? [],
        view: projectGrottoUpdate(input),
    };
}

function computer(overrides: Partial<GrottoUpdateComputer>): GrottoUpdateComputer {
    return {
        currentVersion: '1.4.8',
        health: 'healthy',
        id: 'cmp_studio',
        lastConnectedAt: '2026-08-29T15:00:00.000Z',
        name: 'Home',
        phase: 'available',
        reportedTargetVersion: '1.4.9',
        ...overrides,
    };
}
