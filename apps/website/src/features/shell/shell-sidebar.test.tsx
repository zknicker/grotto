import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Sidebar } from '@heroui-pro/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShellSidebar, ShellSidebarPage, ShellSidebarPageContent } from './shell-sidebar.tsx';
import { SidebarBackToChatRow, SidebarSettingsAction } from './sidebar-settings-action.tsx';

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

test('keeps shared footer presentation outside the active sidebar page', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <ShellSidebar activePage="tasks" footer="Working" settingsAction="Settings">
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
    expect(markup).toContain('Settings');
    expect(markup).toContain('Working');
});

test('seats Settings at the footer\u2019s trailing end, after the Agent activity it shares a line with', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <ShellSidebar activePage="tasks" footer="Working" settingsAction="Settings">
                <ShellSidebarPage ariaLabel="Tasks" value="tasks">
                    Tasks
                </ShellSidebarPage>
            </ShellSidebar>
        </Sidebar.Provider>
    );

    // Off the desktop there is no titlebar strip to ride in, so the gear is an
    // ordinary footer item — rendered where it is drawn, so the tab order
    // reaches it after the navigation rather than before.
    const footer = markup.slice(markup.indexOf('data-slot="sidebar-footer"'));
    expect(footer).toContain('Settings');
    expect(footer.indexOf('Working')).toBeLessThan(footer.indexOf('Settings'));
    expect(markup.indexOf('Tasks')).toBeLessThan(markup.indexOf('Settings'));
});

test('keeps the footer mounted for the Settings gear when the footer itself is empty', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <ShellSidebar activePage="tasks" settingsAction="Settings">
                <ShellSidebarPage ariaLabel="Tasks" value="tasks">
                    Tasks
                </ShellSidebarPage>
            </ShellSidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('data-slot="sidebar-footer"');
    expect(markup).toContain('Settings');
});

test('stands a sidebar page on its own navigation, with no header band', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <Sidebar>
                <ShellSidebarPageContent>Content</ShellSidebarPageContent>
            </Sidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('data-slot="sidebar-content"');
    // The band element is gone: the lead navigation row itself stands in the
    // shell band, so nothing above it approximates the topbar's midline.
    expect(markup).not.toContain('data-slot="sidebar-header"');
});

test('offsets the sidebar’s first navigation row onto the shell band’s midline', () => {
    const shellCss = readFileSync(new URL('./shell.css', import.meta.url), 'utf8');
    const lead =
        /\.app-shell\s+\[data-slot='sidebar-content'\]\s+>\s+\[data-slot='sidebar-group'\]:first-child\s+\[data-slot='sidebar-menu-item'\]:first-child\s*\{([^}]*)\}/.exec(
            shellCss
        )?.[1];

    // A top offset of half the band, derived from HeroUI's own row box, not a
    // full band around the row: standing the row in a band centred it but left
    // the band's lower half as a gap before the next row.
    expect(lead?.replace(/\s+/gu, ' ')).toContain(
        'margin-block-start: calc( (var(--app-shell-band-height) - var(--spacing) * 9) / 2 )'
    );
    expect(lead).not.toContain('min-height');
    // The sidebar's top padding is the macOS titlebar strip and nothing else,
    // so the offset starts at the sidebar's content top on both surfaces.
    expect(shellCss).toContain('padding-block-start: var(--app-shell-titlebar-inset);');
    expect(shellCss).not.toMatch(/padding-block-start:\s*calc\(\s*var\(--spacing\)/);
    // The gear floats only where there is a titlebar strip to float in.
    expect(shellCss).toMatch(
        /html\.macos-electron[^{]*\.app-shell-titlebar-action\s*\{[^}]*position:\s*absolute/
    );
    expect(shellCss).not.toMatch(/html:not\(\.macos-electron\)[^{]*\.app-shell-titlebar-action/);
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

test('floats Settings as the sidebar\u2019s only chrome, with no row of its own', () => {
    const markup = renderToStaticMarkup(
        <Sidebar.Provider>
            <Sidebar>
                <SidebarSettingsAction
                    onOpenSettings={() => undefined}
                    onPreloadSettings={() => undefined}
                />
            </Sidebar>
        </Sidebar.Provider>
    );

    expect(markup).toContain('aria-label="Settings"');
    expect(markup).toContain('app-shell-titlebar-action');
    // No row of its own on either surface: the macOS titlebar strip, or the
    // footer line it shares with live Agent activity.
    expect(markup).not.toContain('app-shell-settings-band');
    expect(markup).not.toContain('data-slot="sidebar-menu-item"');
    expect(markup).not.toContain('Switch Server');
});
