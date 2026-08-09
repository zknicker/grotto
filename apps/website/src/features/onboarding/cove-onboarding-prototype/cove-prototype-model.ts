/**
 * Static content for the Cove onboarding prototype (PRD-190). Nothing here
 * talks to a Server or Computer — every command, status line, and runtime is
 * fixed review copy.
 */
export const covePrototypeStates = [
    'choose-server',
    'create-server',
    'connect-computer',
    'command-run',
    'connect-failed',
    'runtimes-detected',
    'meet-cove',
    'validation-error',
    'creating-cove',
    'creation-failed',
    'handoff',
    'onboarding-chat',
] as const;

export type CovePrototypeState = (typeof covePrototypeStates)[number];

export interface CovePrototypeStateOption {
    description: string;
    id: CovePrototypeState;
    label: string;
}

export const covePrototypeStateOptions: CovePrototypeStateOption[] = [
    {
        description: 'Choose an existing Server before setup begins.',
        id: 'choose-server',
        label: 'Choose a Server',
    },
    {
        description: 'Create a new Server, then start setup.',
        id: 'create-server',
        label: 'Create a Server',
    },
    {
        description: 'Install and setup commands, nothing connected yet.',
        id: 'connect-computer',
        label: 'Connect a Computer',
    },
    {
        description: 'Setup ran; waiting on runtime detection.',
        id: 'command-run',
        label: 'Command run · waiting',
    },
    {
        description: 'The Computer stopped before reporting runtimes.',
        id: 'connect-failed',
        label: 'Setup error · retry',
    },
    {
        description: 'Runtimes reported; Next is enabled.',
        id: 'runtimes-detected',
        label: 'Runtimes detected',
    },
    {
        description: 'Choose the runtime and model Cove runs on.',
        id: 'meet-cove',
        label: 'Meet Cove',
    },
    {
        description: 'Runtime and model are missing.',
        id: 'validation-error',
        label: 'Meet Cove · validation',
    },
    {
        description: 'Cove is being created.',
        id: 'creating-cove',
        label: 'Meet Cove · creating',
    },
    {
        description: 'Creation stopped and can be retried without a second Cove.',
        id: 'creation-failed',
        label: 'Meet Cove · error',
    },
    {
        description: 'Setup is done and Cove is waiting in the Chat.',
        id: 'handoff',
        label: 'Handoff',
    },
    {
        description: 'The private onboarding Chat with Cove.',
        id: 'onboarding-chat',
        label: 'Onboarding Chat',
    },
];

export const covePrototypeServerSlug = 'grotto';

/** Grotto Computer ships Apple Silicon macOS only; Windows stays visible but unselectable. */
export const covePrototypePlatforms = [
    { id: 'macos', isAvailable: true, label: 'macOS (Apple Silicon)' },
    { id: 'windows', isAvailable: false, label: 'Windows' },
] as const;

export type CovePrototypePlatformId = (typeof covePrototypePlatforms)[number]['id'];

export interface CoveStatusLine {
    label: string;
    tone: 'done' | 'failed' | 'waiting';
}

export function getConnectStatusLines(state: CovePrototypeState): CoveStatusLine[] {
    const approved: CoveStatusLine = { label: 'Request approved.', tone: 'done' };
    const connected: CoveStatusLine = { label: 'Computer connected.', tone: 'done' };

    if (state === 'command-run') {
        return [approved, connected, { label: 'Detecting runtimes…', tone: 'waiting' }];
    }
    if (state === 'connect-failed') {
        return [
            approved,
            {
                label: 'Setup stopped before the Computer reported its runtimes.',
                tone: 'failed',
            },
        ];
    }
    if (state === 'runtimes-detected') {
        return [
            approved,
            connected,
            { label: `Runtimes detected: ${getDetectedRuntimeLabels()}.`, tone: 'done' },
        ];
    }
    return [];
}

export interface CovePrototypeModel {
    id: string;
    label: string;
}

export interface CovePrototypeRuntime {
    id: string;
    label: string;
    models: CovePrototypeModel[];
    status: 'ready' | 'undetected';
}

export const covePrototypeRuntimes: CovePrototypeRuntime[] = [
    {
        id: 'codex',
        label: 'Codex',
        models: [
            { id: 'gpt-5.5', label: 'GPT-5.5' },
            { id: 'gpt-5.4', label: 'GPT-5.4' },
            { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
        ],
        status: 'ready',
    },
    {
        id: 'claude-code',
        label: 'Claude Code',
        models: [
            { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
            { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
        ],
        status: 'ready',
    },
    { id: 'pi', label: 'Pi', models: [], status: 'undetected' },
];

export interface CoveConfigDraft {
    modelId: string;
    runtimeId: string;
}

export interface CoveConfigErrors {
    model?: string;
    runtime?: string;
}

export function getCoveConfigErrors(draft: CoveConfigDraft): CoveConfigErrors {
    const runtime = covePrototypeRuntimes.find((candidate) => candidate.id === draft.runtimeId);
    const model = runtime?.models.find((candidate) => candidate.id === draft.modelId);
    const errors: CoveConfigErrors = {};

    if (!runtime || runtime.status === 'undetected') {
        errors.runtime = 'Choose a runtime the Computer reported.';
    }
    if (!model) {
        errors.model = 'Choose a model from the selected runtime.';
    }

    return errors;
}

export function isValidCoveConfig(draft: CoveConfigDraft): boolean {
    return Object.keys(getCoveConfigErrors(draft)).length === 0;
}

export function getPrototypeStateOption(state: CovePrototypeState): CovePrototypeStateOption {
    const option = covePrototypeStateOptions.find((candidate) => candidate.id === state);
    if (option) {
        return option;
    }

    const fallback = covePrototypeStateOptions[0];
    if (!fallback) {
        throw new Error('Cove prototype state options are empty');
    }

    return fallback;
}

export function getStepperIndex(state: CovePrototypeState): number {
    if (state === 'handoff' || state === 'onboarding-chat') {
        return 2;
    }
    if (
        state === 'meet-cove' ||
        state === 'validation-error' ||
        state === 'creating-cove' ||
        state === 'creation-failed'
    ) {
        return 1;
    }
    return 0;
}

export function isCovePrototypeState(value: string | null): value is CovePrototypeState {
    return value !== null && covePrototypeStates.includes(value as CovePrototypeState);
}

function getDetectedRuntimeLabels(): string {
    return covePrototypeRuntimes
        .filter((runtime) => runtime.status === 'ready')
        .map((runtime) => runtime.label)
        .join(', ');
}
