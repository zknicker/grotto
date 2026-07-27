import { Link, useParams } from 'react-router-dom';
import { ComputerUpdateControls } from '../../features/servers/computer-update-controls.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Server settings inventory; status is supplied only by an authenticated Computer socket. */
export function ServerComputersPage() {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const computers = grottoTrpc.computer.list.useQuery(
        { serverId: server.data?.id ?? '' },
        {
            enabled: Boolean(server.data),
            refetchInterval: 1000,
        }
    );
    if (!server.data) {
        return null;
    }
    if (server.data.role === 'member') {
        return (
            <main className="grid min-h-dvh place-content-center text-muted-foreground text-sm">
                Owner or Admin required.
            </main>
        );
    }
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 p-6">
            <Link
                className="text-muted-foreground text-sm hover:text-foreground"
                to={serverRoute(slug)}
            >
                Back to /{slug}
            </Link>
            <div>
                <h1 className="font-semibold text-foreground text-xl">Computers</h1>
                <p className="text-muted-foreground text-sm">
                    Run <code>grotto-computer setup /{slug}</code> on an Apple Silicon Mac.
                </p>
            </div>
            {computers.data?.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {computers.data.map((computer) => (
                        <li className="flex flex-col gap-2 p-4" key={computer.id}>
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="font-medium text-sm">
                                        {computer.operatingSystem ?? 'Awaiting connection'} ·{' '}
                                        {computer.architecture ?? '—'}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        v{computer.productVersion ?? '—'} · protocol{' '}
                                        {computer.protocolVersion ?? '—'}
                                    </p>
                                </div>
                                <span className="text-muted-foreground text-sm">
                                    {computer.health}
                                </span>
                            </div>
                            {computer.reportedInventory?.runtimes.length ? (
                                <ul className="flex flex-col gap-0.5">
                                    {computer.reportedInventory.runtimes.map((runtime) => (
                                        <li
                                            className="text-muted-foreground text-xs"
                                            key={runtime.id}
                                        >
                                            <span className="text-foreground">{runtime.label}</span>{' '}
                                            ·{' '}
                                            {runtime.models.map((model) => model.label).join(', ')}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-xs">
                                    No runtimes reported yet.
                                </p>
                            )}
                            <ComputerUpdateControls computer={computer} serverId={server.data.id} />
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground text-sm">No Computers attached.</p>
            )}
        </main>
    );
}
