import type { AgentRuntimeConnectionOutput } from '../../../lib/trpc.tsx';

type RuntimeConnection = NonNullable<AgentRuntimeConnectionOutput>;
type RuntimeCapability = RuntimeConnection['capabilities'][number];
type CapabilityId = RuntimeCapability['capability'];
type CapabilityCategoryId = 'extensions' | 'knowledge' | 'runtimeCore';
export type CapabilityCriticality = 'primary' | 'required' | 'supporting';

export interface CapabilityView {
    category: CapabilityCategory;
    criticality: CapabilityCriticality;
    item: RuntimeCapability;
    label: string;
}

interface CapabilityCategory {
    id: CapabilityCategoryId;
    label: string;
}

const categories: CapabilityCategory[] = [
    { id: 'runtimeCore', label: 'Runtime core' },
    { id: 'knowledge', label: 'Knowledge & memory' },
    { id: 'extensions', label: 'Skills & models' },
];

const capabilityCategories: Partial<Record<CapabilityId, CapabilityCategoryId>> = {
    apiServer: 'runtimeCore',
    claudeAuth: 'runtimeCore',
    codexOAuth: 'runtimeCore',
    dashboardServer: 'runtimeCore',
    gateway: 'runtimeCore',
    memory: 'knowledge',
    memoryDreaming: 'knowledge',
    memoryExtraction: 'knowledge',
    modelExecution: 'extensions',
    browser: 'extensions',
    skills: 'extensions',
};

const capabilityDisplayOrder: CapabilityId[] = [
    'claudeAuth',
    'codexOAuth',
    'apiServer',
    'dashboardServer',
    'gateway',
    'memory',
    'memoryExtraction',
    'memoryDreaming',
    'modelExecution',
    'skills',
    'browser',
];

const capabilityDisplayRank = new Map(
    capabilityDisplayOrder.map((capability, index) => [capability, index] as const)
);

const requiredCapabilities = new Set<CapabilityId>([
    'apiServer',
    'dashboardServer',
    'gateway',
    'modelExecution',
    'skills',
]);

const supportingCapabilities = new Set<CapabilityId>(['claudeAuth', 'codexOAuth']);

// Customer-facing explainers shown in each capability's hover card. Plain
// product language: what the user gets when this is healthy.
const capabilityDescriptions: Partial<Record<CapabilityId, string>> = {
    apiServer: 'The control surface the app uses to manage and inspect agent execution.',
    claudeAuth: 'Claude account access, so agents can run on your Claude subscription models.',
    codexOAuth: 'Codex account access, so agents can run on your Codex subscription models.',
    cron: 'Scheduled automations, so agents can check in, remind, and report on a timer.',
    dashboardServer: 'The engine that executes your agents’ turns.',
    devToolkit: 'Development-stack tools for simulated agent turns. Off in normal installs.',
    gateway: 'Delivers your messages to agents and streams their replies and activity back.',
    memory: 'Per-agent USER.md and MEMORY.md files are enabled and available in each agent workspace.',
    memoryDreaming:
        'Background dreaming can promote stable evidence into Wiki and per-agent Memory using the Standard background model.',
    memoryExtraction:
        'Background extraction can distill settled conversations into per-agent episodic evidence using the Fast background model.',
    modelExecution: 'At least one AI model is connected and ready to run agent turns.',
    browser: 'Managed Chrome browser for agent web automation.',
    skills: 'Reusable skills agents load for specialized tasks.',
};

export function getCapabilityDescription(capability: RuntimeCapability) {
    return capabilityDescriptions[capability.capability] ?? null;
}

export function getCapabilityLabel(capability: RuntimeCapability) {
    return capability.displayName ?? capability.capability;
}

export function groupCapabilities(capabilities: RuntimeConnection['capabilities']) {
    const views = capabilities.map((item): CapabilityView => {
        return {
            category: getCapabilityCategory(item),
            criticality: getCapabilityCriticality(item),
            item,
            label: getCapabilityLabel(item),
        };
    });

    return categories
        .map((category) => ({
            category,
            items: views
                .filter((view) => view.category.id === category.id)
                .sort(compareCapabilities),
        }))
        .filter((group) => group.items.length > 0);
}

function getCapabilityCriticality(capability: RuntimeCapability): CapabilityCriticality {
    if (requiredCapabilities.has(capability.capability)) {
        return 'required';
    }
    if (supportingCapabilities.has(capability.capability)) {
        return 'supporting';
    }
    return 'primary';
}

function getCapabilityCategory(capability: RuntimeCapability): CapabilityCategory {
    const categoryId = capabilityCategories[capability.capability] ?? 'runtimeCore';
    return categories.find((category) => category.id === categoryId) ?? categories.at(-1)!;
}

function compareCapabilities(a: CapabilityView, b: CapabilityView) {
    const aRank = capabilityDisplayRank.get(a.item.capability);
    const bRank = capabilityDisplayRank.get(b.item.capability);
    if (aRank !== undefined && bRank !== undefined && aRank !== bRank) {
        return aRank - bRank;
    }
    if (aRank !== undefined) {
        return -1;
    }
    if (bRank !== undefined) {
        return 1;
    }

    return a.label.localeCompare(b.label);
}
