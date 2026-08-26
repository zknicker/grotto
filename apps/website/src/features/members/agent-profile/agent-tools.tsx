import type { Agent } from '@grotto/api';
import { ItemCardGroup } from '@heroui-pro/react';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { AgentTools as ServerAgentTools } from '../../../routes/app/agent-tools.tsx';
import { PageColumn } from '../../shell/page-column.tsx';
import { AgentSkills } from './agent-skills.tsx';

export function AgentTools({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const computers = useComputers(server.id);
    const connections = useConnections(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const skills =
        inventory?.agentSkills?.find((entry) => entry.agentId === agent.id)?.skills ?? [];
    const canEdit = server.role === 'owner' || server.role === 'admin';

    return (
        <PageColumn>
            {connections.error && !connections.data ? (
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>Agent MCP Access</ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <p className="px-1 text-danger text-sm" role="alert">
                        {connections.error.message}
                    </p>
                </ItemCardGroup>
            ) : connections.data ? (
                <ServerAgentTools
                    agent={agent}
                    connections={connections.data}
                    serverId={server.id}
                />
            ) : (
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>Agent MCP Access</ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <div aria-busy="true" className="min-h-24">
                        <span className="sr-only">Loading MCP connections</span>
                    </div>
                </ItemCardGroup>
            )}
            {computers.error && !computers.data ? (
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>Skills</ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <p className="px-1 text-danger text-sm" role="alert">
                        {computers.error.message}
                    </p>
                </ItemCardGroup>
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
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>Skills</ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <div aria-busy="true" className="min-h-24">
                        <span className="sr-only">Loading Skills</span>
                    </div>
                </ItemCardGroup>
            )}
        </PageColumn>
    );
}
