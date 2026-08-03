import type { HostedAgent, HostedChat } from '@tavern/api';
import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildHostedCommandGroups } from '../../commands/hosted-commands.ts';
import { useDevMode } from '../../components/dev-mode-provider.tsx';
import { type AgentAvatarLookup, CommandMenuShell } from './command-menu.tsx';

export function HostedCommandMenu({
    agents,
    chats,
    role,
    serverSlug,
}: {
    agents: HostedAgent[];
    chats: HostedChat[];
    role: 'admin' | 'member' | 'owner';
    serverSlug: string;
}) {
    const { pathname } = useLocation();
    const navigateRoute = useNavigate();
    const { devMode, setDevMode } = useDevMode();
    const navigate = React.useCallback(
        (path: string) => {
            void navigateRoute(path);
        },
        [navigateRoute]
    );
    const commandGroups = React.useMemo(
        () =>
            buildHostedCommandGroups({
                agents,
                chats,
                devMode,
                navigate,
                pathname,
                role,
                serverSlug,
                setDevMode,
            }),
        [agents, chats, devMode, navigate, pathname, role, serverSlug, setDevMode]
    );
    const lookupAgentAvatarUrl = React.useMemo<AgentAvatarLookup>(() => {
        const avatarById = new Map(agents.map((agent) => [agent.id, agent.avatarUrl]));

        return (agentId) => (agentId ? (avatarById.get(agentId) ?? null) : null);
    }, [agents]);

    return (
        <CommandMenuShell
            commandGroups={commandGroups}
            lookupAgentAvatarUrl={lookupAgentAvatarUrl}
        />
    );
}
