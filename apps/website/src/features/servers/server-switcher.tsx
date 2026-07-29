import { NavLink } from 'react-router-dom';
import { navSelectedClass } from '../../components/ui/nav.tsx';
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
                            'rounded-lg px-3 py-2 text-left text-foreground text-sm',
                            isActive ? navSelectedClass : 'hover:bg-active'
                        )
                    }
                    key={server.id}
                    onClick={onSelect}
                    to={serverRoute(server.slug)}
                >
                    <span className="block">{server.displayName}</span>
                    <span className="block text-meta text-muted-foreground">/{server.slug}</span>
                </NavLink>
            ))}
        </nav>
    );
}
