import type { HostedAgent } from '@tavern/api';
import { useComputers } from '../../../hooks/members/use-computers.ts';
import { useConnections } from '../../../hooks/members/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { HostedAgentTools } from '../../../routes/app/hosted-agent-tools.tsx';
import { SettingsPage } from '../../settings/layout/settings-page.tsx';
import { AgentSkills } from './agent-skills.tsx';

export function AgentTools({ agent, server }: { agent: HostedAgent; server: ServerDetail }) {
    const computers = useComputers(server.id);
    const connections = useConnections(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const skills =
        inventory?.agentSkills?.find((entry) => entry.agentId === agent.id)?.skills ?? [];
    const canEdit = server.role === 'owner' || server.role === 'admin';

    return (
        <div className="px-4 py-6">
            <SettingsPage>
                <HostedAgentTools
                    agent={agent}
                    connections={connections.data ?? []}
                    serverId={server.id}
                />
                <AgentSkills
                    agent={agent}
                    canEdit={canEdit}
                    imports={inventory?.agentSkillImports ?? []}
                    server={server}
                    skillSources={inventory?.importableSkills ?? []}
                    skills={skills}
                />
            </SettingsPage>
        </div>
    );
}
