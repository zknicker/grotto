import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { HostedServerContextValue } from '../../features/servers/hosted-server-context.ts';
import { useHostedServerContext } from '../../features/servers/hosted-server-context.ts';
import { ServerMembersPage } from './server-members-page.tsx';

test('Members forwards the Server route context to profile routes', () => {
    const context = {
        server: { slug: 'dev' },
    } as HostedServerContextValue;

    expect(() =>
        renderToStaticMarkup(
            <MemoryRouter initialEntries={['/members/agents/blippy']}>
                <Routes>
                    <Route element={<Outlet context={context} />}>
                        <Route>
                            <Route element={<ServerMembersPage />} path="members">
                                <Route element={<ServerProbe />} path="agents/:agentId" />
                            </Route>
                        </Route>
                    </Route>
                </Routes>
            </MemoryRouter>
        )
    ).not.toThrow();
});

function ServerProbe() {
    const { server } = useHostedServerContext();
    return <span>{server.slug}</span>;
}
