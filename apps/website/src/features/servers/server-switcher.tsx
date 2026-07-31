import { NavLink } from 'react-router-dom';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { cn } from '../../lib/utils.ts';
import { serverRoute } from './server-routes.ts';

/** Switches between the Grotto servers this human can open. */
export function ServerSwitcher({
    onSelect,
    servers,
}: {
    onSelect?: () => void;
    servers: ServerSummary[];
}) {
    return (
        <nav aria-label="Your Servers" className="flex flex-col gap-1">
            {servers.map((server) => (
                <NavLink
                    className={({ isActive }) =>
                        cn(
                            'rounded-lg px-3 py-2 text-left text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus',
                            isActive ? 'bg-surface-secondary' : 'hover:bg-surface-secondary'
                        )
                    }
                    key={server.id}
                    onClick={onSelect}
                    to={serverRoute(server.slug)}
                >
                    <span className="block">{server.displayName}</span>
                    <span className="block text-muted text-xs">/{server.slug}</span>
                </NavLink>
            ))}
        </nav>
    );
}
