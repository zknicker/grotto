import { expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import type { ServerContextValue } from '../../features/servers/server-context.ts';
import { useServerContext } from '../../features/servers/server-context.ts';

// The page owns its roster, which reads the Agent and Human queries. This test
// is about route context reaching the detail column, so the roster is stubbed
// rather than dragged through a Server provider.
mock.module('../../features/members/member-roster.tsx', () => ({
    MemberRoster: () => null,
}));

const { MembersPage } = await import('./members-page.tsx');

test('Members forwards the Server route context to profile routes', () => {
    const context = {
        server: { slug: 'dev' },
    } as ServerContextValue;

    const html = renderToStaticMarkup(
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
    );

    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('scrollbar-gutter:stable');
});

function ServerProbe() {
    const { server } = useServerContext();
    return <span>{server.slug}</span>;
}
