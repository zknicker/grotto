import { Card, Spinner } from '@heroui/react';
import { Navigate } from 'react-router-dom';
import { ActivationShell, ActivationStep } from '../../components/activation/activation-shell.tsx';
import { readLastServerSlug, resolveEntryServer } from '../../features/servers/server-choice.ts';
import { ServerChoicePanel } from '../../features/servers/server-choice-panel.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** Resolves signed-in entry to a joined Server; only the empty state remains here. */
export function ServersPage() {
    const servers = useServerList();

    if (!servers.data && servers.error) {
        return (
            <ActivationShell>
                <ActivationStep description={servers.error.message} title="Servers Unavailable" />
            </ActivationShell>
        );
    }

    if (!servers.data) {
        return (
            <ActivationShell>
                <Spinner aria-label="Loading your Servers" size="sm" />
            </ActivationShell>
        );
    }

    const entryServer = resolveEntryServer(servers.data, readLastServerSlug());
    if (entryServer) {
        return <Navigate replace to={serverRoute(entryServer.slug)} />;
    }

    return (
        <ActivationShell>
            <ActivationStep
                description="Create a Server or join one with an invitation."
                title="Your First Server"
            >
                <Card>
                    <Card.Content>
                        <ServerChoicePanel servers={[]} />
                    </Card.Content>
                </Card>
            </ActivationStep>
        </ActivationShell>
    );
}
