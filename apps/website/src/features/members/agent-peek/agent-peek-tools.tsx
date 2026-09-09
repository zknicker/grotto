import type { Agent } from '@grotto/api';
import { Chip } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { formatSkillName } from '../../skills/skill-name-format.ts';
import { grantedAgentConnections } from '../agent-profile/agent-glance-model.ts';
import {
    type AgentPeekNames,
    summarizeAgentNames,
    summarizeAgentSkills,
} from './agent-peek-model.ts';
import { PeekPressableCard, PeekSection } from './peek-section.tsx';

/**
 * What this Agent can reach: the Skills in its workspace and the MCP
 * connections it can actually call — `grantedAgentConnections`, the same set
 * the Overview tile counts. Names only: granting and importing are the
 * profile's Setup tab, so the peek carries no toggle and no add.
 */
export function AgentPeekTools({
    agent,
    onOpenSetup,
    server,
}: {
    agent: Agent;
    onOpenSetup: () => void;
    server: ServerDetail;
}) {
    const computers = useComputers(server.id);
    const connections = useConnections(server.id);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory ?? null;
    const skills = computers.isPending
        ? null
        : summarizeAgentSkills({
              // The Computer reports a skill's directory name; the display name
              // is the profile's, so both surfaces name one product.
              names: (
                  inventory?.agentSkills?.find((entry) => entry.agentId === agent.id)?.skills ?? []
              ).map((skill) => formatSkillName(skill.name)),
              reported: Boolean(inventory),
          });
    const granted = connections.data
        ? summarizeAgentNames(
              grantedAgentConnections(connections.data, agent.id).map(
                  (connection) => connection.name
              ),
              'No connections yet.'
          )
        : null;

    return (
        <>
            <PeekNameSection
                label="Open this Agent's skills"
                names={skills}
                onOpen={onOpenSetup}
                title="Skills"
            />
            <PeekNameSection
                label="Open this Agent's connections"
                names={granted}
                onOpen={onOpenSetup}
                title="Connections"
            />
        </>
    );
}

function PeekNameSection({
    label,
    names,
    onOpen,
    title,
}: {
    label: string;
    /** Null while the read settles — the section is its header alone. */
    names: AgentPeekNames | null;
    onOpen: () => void;
    title: string;
}) {
    return (
        <PeekSection count={names?.kind === 'names' ? names.names.length : undefined} title={title}>
            {names ? (
                <PeekPressableCard label={label} onPress={onOpen}>
                    <ItemCard.Content>
                        {names.kind === 'empty' ? (
                            <ItemCard.Description>{names.label}</ItemCard.Description>
                        ) : (
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                {names.names.map((name) => (
                                    <Chip key={name} size="sm" variant="secondary">
                                        <Chip.Label className="truncate">{name}</Chip.Label>
                                    </Chip>
                                ))}
                            </div>
                        )}
                    </ItemCard.Content>
                </PeekPressableCard>
            ) : null}
        </PeekSection>
    );
}
