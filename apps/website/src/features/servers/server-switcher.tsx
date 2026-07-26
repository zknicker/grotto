import { NavLink } from 'react-router-dom';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { cn } from '../../lib/utils.ts';
import { serverRoute } from './server-routes.ts';

/** Switches between the Grotto servers this human can open. */
export function ServerSwitcher({ servers }: { servers: ServerSummary[] }) {
    return (
        <nav aria-label="Your Servers" className="flex flex-col gap-1">
            {servers.map((server) => (
                <NavLink
                    className={({ isActive }) =>
                        cn(
                            'rounded-lg border border-transparent px-3 py-2 text-left text-foreground text-sm',
                            isActive
                                ? 'border-input bg-secondary shadow-[0_2px_0_0_var(--hard-shadow)]'
                                : 'hover:bg-active'
                        )
                    }
                    key={server.id}
                    to={serverRoute(server.slug)}
                >
                    <span className="block">{server.displayName}</span>
                    <span className="block text-meta text-muted-foreground">/{server.slug}</span>
                </NavLink>
            ))}
        </nav>
    );
}
