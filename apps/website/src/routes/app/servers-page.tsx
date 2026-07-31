import { Card } from '@heroui/react';
import { Navigate } from 'react-router-dom';
import { AppShell, AppShellDragRegion } from '../../components/ui/app-shell.tsx';
import { readLastServerSlug, resolveEntryServer } from '../../features/servers/server-choice.ts';
import { ServerChoicePanel } from '../../features/servers/server-choice-panel.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** Resolves signed-in entry to a joined Server; only the empty state remains here. */
export function ServersPage() {
    const servers = useServerList();

    if (!servers.data && servers.error) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Servers Unavailable</h1>
                <p className="max-w-sm text-muted text-sm">{servers.error.message}</p>
            </main>
        );
    }

    if (!servers.data) {
        return null;
    }

    const entryServer = resolveEntryServer(servers.data, readLastServerSlug());
    if (entryServer) {
        return <Navigate replace to={serverRoute(entryServer.slug)} />;
    }

    return <EmptyServerShell />;
}

function EmptyServerShell() {
    return (
        <AppShell>
            <AppShellDragRegion />
            <main className="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-16">
                <div className="flex w-full max-w-lg flex-col gap-6">
                    <header className="flex flex-col gap-2">
                        <h1 className="font-display text-2xl text-foreground">Your First Server</h1>
                        <p className="text-muted text-sm">
                            Create a Server or join one with an invitation.
                        </p>
                    </header>
                    <Card>
                        <Card.Content>
                            <ServerChoicePanel servers={[]} />
                        </Card.Content>
                    </Card>
                </div>
            </main>
        </AppShell>
    );
}
