import { describe, expect, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { grottoTrpc, type ServerSummary } from '../../../lib/grotto-server.tsx';
import { ServersSettingsView } from './page.tsx';

const servers: ServerSummary[] = [
    { displayName: 'Grotto HQ', id: 'server-1', role: 'owner', slug: 'grotto-hq' },
    { displayName: 'Side Quest', id: 'server-2', role: 'member', slug: 'side-quest' },
];

describe('ServersSettingsView', () => {
    test('lists the Servers you belong to and marks the one you are in', () => {
        const markup = render(servers, '/s/grotto-hq/settings/servers');

        expect(markup).toContain('Grotto HQ');
        expect(markup).toContain('/side-quest');
        expect(markup).toContain('href="/s/side-quest"');
        // NavLink marks the Server you are in; the rest are plain destinations.
        expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    });

    test('offers create and join with no Server list to hang them off', () => {
        const markup = render([], '/s/grotto-hq/settings/servers');

        expect(markup).toContain('Create a Server');
        expect(markup).toContain('Join a Server');
    });

    test('stays blank while the Server list is still loading', () => {
        const markup = render(undefined, '/s/grotto-hq/settings/servers');

        // No flash of an empty list before the snapshot arrives.
        expect(markup).not.toContain('href="/s/');
    });
});

/**
 * The page mounts the create and join dialogs itself, and those run real
 * mutation hooks, so the render needs a client — no request leaves it.
 */
function render(list: ServerSummary[] | undefined, path: string) {
    const queryClient = new QueryClient();
    const client = grottoTrpc.createClient({
        links: [httpBatchLink({ url: 'http://127.0.0.1:1/trpc' })],
    });

    return renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
            <grottoTrpc.Provider client={client} queryClient={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <ServersSettingsView servers={list} />
                </MemoryRouter>
            </grottoTrpc.Provider>
        </QueryClientProvider>
    );
}
