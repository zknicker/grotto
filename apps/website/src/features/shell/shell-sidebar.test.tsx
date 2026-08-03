import { expect, test } from 'bun:test';
import { Sidebar } from '@heroui-pro/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShellSidebar, ShellSidebarPage } from './shell-sidebar.tsx';

test('gives HeroUI direct pages so inactive sidebars receive a slide offset', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <ShellSidebar activePage="server">
                <ShellSidebarPage ariaLabel="Server" value="server">
                    Server
                </ShellSidebarPage>
                <ShellSidebarPage ariaLabel="Tasks" value="tasks">
                    Tasks
                </ShellSidebarPage>
                {null}
            </ShellSidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('data-slot="sidebar-page"');
    expect(markup).toContain('transform:translateX(100%)');
});
