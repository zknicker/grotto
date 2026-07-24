import type { AgentListOutput } from '../../lib/trpc.tsx';

/**
 * Unique-suffix a proposed handle against the existing agent roster.
 * Handles are case-insensitively unique (W1), so collision checks compare
 * lowercased while the returned name keeps the proposal's casing.
 */
export function createNewAgentName(agents: AgentListOutput['agents'], base = 'new-agent') {
    const names = new Set(agents.map((agent) => agent.name.trim().toLowerCase()));
    const normalizedBase = base.toLowerCase();
    if (!names.has(normalizedBase)) {
        return base;
    }

    let suffix = 2;
    while (names.has(`${normalizedBase}-${suffix}`)) {
        suffix += 1;
    }
    return `${base}-${suffix}`;
}
