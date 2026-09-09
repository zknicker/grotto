import type { Agent } from '@grotto/api';
import { ItemCardGroup } from '@heroui-pro/react';
import type * as React from 'react';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { AgentTools as AgentConnections } from '../../../routes/app/agent-tools.tsx';
import { AgentProfileCard } from './agent-profile-card.tsx';
import { AgentRuntime } from './agent-runtime.tsx';
import { AgentSkills } from './agent-skills.tsx';

/**
 * Everything about an Agent a human configures: who it is, what it runs on,
 * which Server connections it may call, and which Skills it owns. These were
 * three separate destinations — identity and model on Overview, the rest on
 * Tools — which made "change how this Agent works" a two-tab errand.
 */
export function AgentSetup({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const computers = useComputers(server.id);
    const connections = useConnections(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const skills =
        inventory?.agentSkills?.find((entry) => entry.agentId === agent.id)?.skills ?? [];
    const canEdit = server.role === 'owner' || server.role === 'admin';

    return (
        <>
            <AgentProfileCard agent={agent} />
            <AgentRuntime
                agent={agent}
                canEdit={canEdit}
                computerHealth={computer?.health}
                runtimes={inventory?.runtimes ?? []}
                serverId={server.id}
            />
            {connections.error && !connections.data ? (
                <SetupSectionMessage title="Connections">
                    <p className="px-4 text-danger text-sm" role="alert">
                        {connections.error.message}
                    </p>
                </SetupSectionMessage>
            ) : connections.data ? (
                <AgentConnections
                    agent={agent}
                    connections={connections.data}
                    serverId={server.id}
                />
            ) : (
                <SetupSectionMessage title="Connections">
                    <div aria-busy="true" className="min-h-24">
                        <span className="sr-only">Loading MCP connections</span>
                    </div>
                </SetupSectionMessage>
            )}
            {computers.error && !computers.data ? (
                <SetupSectionMessage title="Skills">
                    <p className="px-4 text-danger text-sm" role="alert">
                        {computers.error.message}
                    </p>
                </SetupSectionMessage>
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
                <SetupSectionMessage title="Skills">
                    <div aria-busy="true" className="min-h-24">
                        <span className="sr-only">Loading Skills</span>
                    </div>
                </SetupSectionMessage>
            )}
        </>
    );
}

/** A section that keeps its heading while its list is loading or unavailable. */
function SetupSectionMessage({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>{title}</ItemCardGroup.Title>
            </ItemCardGroup.Header>
            {children}
        </ItemCardGroup>
    );
}
