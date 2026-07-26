import { CreateServerForm } from '../../features/servers/create-server-form.tsx';
import { ServerSwitcher } from '../../features/servers/server-switcher.tsx';
import { useServerList } from '../../hooks/servers/use-server-list.ts';

/** Lists the Grotto servers this human can open, and creates new ones. */
export function ServersPage() {
    const servers = useServerList();

    return (
        <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-16">
            <div className="flex flex-col gap-2">
                <h1 className="font-display text-2xl text-foreground">Your Servers</h1>
                <p className="text-muted-foreground text-sm">
                    A Server is where your people, agents, and channels live.
                </p>
            </div>
            {servers.data && servers.data.length > 0 ? (
                <ServerSwitcher servers={servers.data} />
            ) : null}
            <CreateServerForm />
        </main>
    );
}
