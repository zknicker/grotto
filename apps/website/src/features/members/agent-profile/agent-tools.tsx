import type { HostedAgent } from '@tavern/api';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { HostedAgentTools } from '../../../routes/app/hosted-agent-tools.tsx';
import { SettingsPage, SettingsSection } from '../../settings/layout/settings-page.tsx';
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
                {connections.error && !connections.data ? (
                    <SettingsSection title="Agent MCP Access">
                        <p className="px-1 text-danger text-sm" role="alert">
                            {connections.error.message}
                        </p>
                    </SettingsSection>
                ) : connections.data ? (
                    <HostedAgentTools
                        agent={agent}
                        connections={connections.data}
                        serverId={server.id}
                    />
                ) : (
                    <SettingsSection title="Agent MCP Access">
                        <div aria-busy="true" className="min-h-24">
                            <span className="sr-only">Loading MCP connections</span>
                        </div>
                    </SettingsSection>
                )}
                {computers.error && !computers.data ? (
                    <SettingsSection title="Skills">
                        <p className="px-1 text-danger text-sm" role="alert">
                            {computers.error.message}
                        </p>
                    </SettingsSection>
                ) : computers.data ? (
                    <AgentSkills
                        agent={agent}
                        canEdit={canEdit}
                        imports={inventory?.agentSkillImports ?? []}
                        server={server}
                        skillSources={inventory?.importableSkills ?? []}
                        skills={skills}
                    />
                ) : (
                    <SettingsSection title="Skills">
                        <div aria-busy="true" className="min-h-24">
                            <span className="sr-only">Loading Skills</span>
                        </div>
                    </SettingsSection>
                )}
            </SettingsPage>
        </div>
    );
}
