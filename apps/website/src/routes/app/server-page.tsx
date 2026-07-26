import { useParams } from 'react-router-dom';
import { ServerSwitcher } from '../../features/servers/server-switcher.tsx';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerEvents } from '../../hooks/servers/use-server-events.ts';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** One Grotto server opened at `/s/<slug>` with its `#all` Channel. */
export function ServerPage() {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const servers = useServerList();

    useServerEvents(server.data?.id);

    if (server.error) {
        return (
            <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
                <h1 className="font-semibold text-foreground text-lg">Server unavailable</h1>
                <p className="max-w-sm text-muted-foreground text-sm">{server.error.message}</p>
            </main>
        );
    }

    if (!server.data) {
        return null;
    }

    const channel = server.data.channels[0];

    return (
        <div className="flex h-dvh w-full">
            <aside className="flex w-64 shrink-0 flex-col gap-4 border-border border-r bg-sidebar p-4">
                <p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                    Servers
                </p>
                <ServerSwitcher servers={servers.data ?? []} />
            </aside>
            <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex flex-col gap-0.5 border-border border-b px-6 py-4">
                    <h1 className="font-semibold text-base text-foreground">
                        {server.data.displayName}
                    </h1>
                    <p className="text-meta text-muted-foreground">/{server.data.slug}</p>
                </header>
                <section aria-label={`#${channel.name}`} className="flex min-h-0 flex-1 flex-col">
                    <h2 className="border-border border-b px-6 py-3 text-foreground text-sm">
                        #{channel.name}
                    </h2>
                    <p className="px-6 py-4 text-muted-foreground text-sm">
                        Everyone in this Server is here.
                    </p>
                </section>
            </main>
        </div>
    );
}
