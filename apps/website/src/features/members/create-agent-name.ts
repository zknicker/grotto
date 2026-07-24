import type { AgentListOutput } from '../../lib/trpc.tsx';

/** Unique-suffix a proposed handle against the existing agent roster. */
export function createNewAgentName(agents: AgentListOutput['agents'], base = 'new-agent') {
    const names = new Set(agents.map((agent) => agent.name.trim().toLowerCase()));
    if (!names.has(base)) {
        return base;
    }

    let suffix = 2;
    while (names.has(`${base}-${suffix}`)) {
        suffix += 1;
    }
    return `${base}-${suffix}`;
}
