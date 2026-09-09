import type { Agent } from '@grotto/api';
import { ItemCardGroup } from '@heroui-pro/react';
import {
    AiMagicIcon,
    AlarmClockIcon,
    BubbleChatIcon,
    ComputerIcon,
    CpuIcon,
    Plug01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { useNavigate } from 'react-router-dom';
import { useAgentChats } from '../../../hooks/members/use-agent-chats.ts';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import { useAgentTriggers } from '../../../hooks/members/use-agent-triggers.ts';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import { useConnections } from '../../../hooks/servers/use-connections.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import {
    computerHealthColor,
    computerHealthLabel,
    computerLabel,
} from '../../computers/presentation.ts';
import { agentProfileRoute, serverComputersRoute } from '../../servers/server-routes.ts';
import {
    countAgentAutomations,
    countAgentSkills,
    formatAgentAutomations,
    grantedAgentConnections,
} from './agent-glance-model.ts';
import { GlanceTile } from './agent-glance-tile.tsx';
import { resolveRuntimeConfig } from './runtime-model.ts';

/**
 * The Agent at a glance: one tile per fact a reader wants before deciding where
 * to go, each tile the doorway to the tab or page that owns it. Counts stay
 * blank while their query settles rather than flashing a zero.
 *
 * Identity, presence, and the lifecycle verbs are the header's; usage, recent
 * turns, and the Chat roster are sections of this same tab below.
 */
export function AgentGlance({
    agent,
    onOpenChats,
    server,
}: {
    agent: Agent;
    /** The Chat roster is a section of this tab, so its tile scrolls rather than routes. */
    onOpenChats: () => void;
    server: ServerDetail;
}) {
    const navigate = useNavigate();
    const canView = server.role !== 'member';
    const chats = useAgentChats(server.id, agent.id);
    const computers = useComputers(server.id);
    const connections = useConnections(server.id);
    const reminders = useAgentReminders(server.id, agent.id, canView);
    const triggers = useAgentTriggers(server.id, agent.id, canView);
    const computer = computers.data?.find((candidate) => candidate.id === agent.computerId);
    const inventory = computer?.reportedInventory;
    const execution = resolveRuntimeConfig(agent, inventory?.runtimes ?? []);
    const automations =
        reminders.data && triggers.data
            ? countAgentAutomations(reminders.data, triggers.data)
            : null;
    const openTab = (tab: string) => navigate(agentProfileRoute(server.slug, agent.id, tab));

    return (
        <ItemCardGroup columns={3} layout="grid">
            <GlanceTile
                icon={ComputerIcon}
                label="Computer"
                onPress={
                    canView
                        ? () =>
                              navigate(
                                  `${serverComputersRoute(server.slug)}?computer=${encodeURIComponent(agent.computerId)}`
                              )
                        : undefined
                }
                secondary={
                    computer
                        ? computerLabel(computer)
                        : computers.isPending
                          ? undefined
                          : 'Assigned Computer unavailable'
                }
                value={
                    computer
                        ? {
                              color: computerHealthColor(computer.health),
                              label: computerHealthLabel(computer.health),
                          }
                        : null
                }
            />
            <GlanceTile
                icon={CpuIcon}
                label="Model"
                onPress={() => openTab('setup')}
                secondary={execution.runtimeLabel}
                value={{
                    color: execution.model ? 'accent' : 'warning',
                    label: execution.model
                        ? execution.modelLabel
                        : `${execution.modelLabel} · not installed`,
                }}
            />
            <GlanceTile
                icon={BubbleChatIcon}
                label="Chats"
                onPress={onOpenChats}
                secondary="Channels and DMs this Agent is in"
                value={chats.data ? { color: 'default', label: String(chats.data.length) } : null}
            />
            <GlanceTile
                icon={AlarmClockIcon}
                label="Automations"
                onPress={() => openTab('automations')}
                secondary={automations ? formatAgentAutomations(automations) : undefined}
                value={automations ? { color: 'default', label: String(automations.total) } : null}
            />
            <GlanceTile
                icon={AiMagicIcon}
                label="Skills"
                onPress={() => openTab('setup')}
                secondary="Independent Agent-owned copies"
                value={
                    inventory
                        ? {
                              color: 'default',
                              label: String(countAgentSkills(inventory.agentSkills, agent.id)),
                          }
                        : null
                }
            />
            <GlanceTile
                icon={Plug01Icon}
                label="Connections"
                onPress={() => openTab('setup')}
                secondary="MCP servers this Agent may call"
                value={
                    connections.data
                        ? {
                              color: 'default',
                              label: String(
                                  grantedAgentConnections(connections.data, agent.id).length
                              ),
                          }
                        : null
                }
            />
        </ItemCardGroup>
    );
}
