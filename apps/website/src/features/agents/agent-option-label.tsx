import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';

export interface AgentSelectOption {
    avatarUrl: string | null;
    id: string;
    name: string;
}

export function AgentOptionLabel({ agent }: { agent: AgentSelectOption }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <EntityAvatar name={agent.name} size={20} src={agent.avatarUrl} />
            <span className="truncate">{agent.name}</span>
        </span>
    );
}
