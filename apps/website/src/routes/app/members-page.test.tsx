import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { ServerContextValue } from '../../features/servers/server-context.ts';
import { useServerContext } from '../../features/servers/server-context.ts';
import { MembersPage } from './members-page.tsx';

test('Members forwards the Server route context to profile routes', () => {
    const context = {
        server: { slug: 'dev' },
    } as ServerContextValue;

    expect(() =>
        renderToStaticMarkup(
            <MemoryRouter initialEntries={['/members/agents/blippy']}>
                <Routes>
                    <Route element={<Outlet context={context} />}>
                        <Route>
                            <Route element={<MembersPage />} path="members">
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
    const { server } = useServerContext();
    return <span>{server.slug}</span>;
}
