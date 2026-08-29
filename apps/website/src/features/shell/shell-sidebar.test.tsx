import { expect, test } from 'bun:test';
import { Sidebar } from '@heroui-pro/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShellSidebar, ShellSidebarPage, ShellSidebarPageContent } from './shell-sidebar.tsx';
import { SidebarBackToChatRow } from './sidebar-server-band.tsx';

test('renders only the active sidebar page so route changes are instant', () => {
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

    expect(markup).toContain('aria-label="Server"');
    expect(markup).toContain('Server');
    expect(markup).not.toContain('Tasks');
});

test('keeps shared header and footer presentation outside the active sidebar page', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <ShellSidebar activePage="tasks" footer="Working" identity="Search">
                <ShellSidebarPage ariaLabel="Server" value="server">
                    Server
                </ShellSidebarPage>
                <ShellSidebarPage ariaLabel="Tasks" value="tasks">
                    Tasks
                </ShellSidebarPage>
            </ShellSidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('Tasks');
    expect(markup).toContain('Search');
    expect(markup).toContain('Working');
});

test('renders every sidebar page through the shared header band', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <Sidebar>
                <ShellSidebarPageContent band="Header">Content</ShellSidebarPageContent>
            </Sidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('data-slot="sidebar-header"');
    expect(markup).toContain('Header');
    expect(markup).toContain('data-slot="sidebar-content"');
});

test('renders back navigation with the shared sidebar menu anatomy', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <Sidebar>
                <SidebarBackToChatRow route="/s/dev/chats/general" />
            </Sidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('data-slot="sidebar-menu-item"');
    expect(markup).toContain('data-slot="sidebar-menu-icon"');
    expect(markup).toContain('data-slot="sidebar-menu-label"');
    expect(markup).toContain('>Back</span>');
    expect(markup).not.toContain('Back to chat</span>');
});
