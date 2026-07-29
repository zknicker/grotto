/** Runtimes the first-party Computer knows how to discover and run. */
export const hostedComputerRuntimeCatalog = [
    { id: 'codex', label: 'Codex' },
    { id: 'claude-code', label: 'Claude Code' },
    { id: 'pi', label: 'Pi' },
] as const;

export type HostedComputerRuntimeId = (typeof hostedComputerRuntimeCatalog)[number]['id'];
