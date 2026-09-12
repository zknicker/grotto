import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Sidebar } from '@heroui-pro/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ChatNavigation } from './chat-navigation.tsx';
import { CommandMenuProvider } from './command-menu-provider.tsx';
import { ShellSidebar, ShellSidebarPage } from './shell-sidebar.tsx';

test('leads the Server menu with Inbox under the Haus mark', () => {
    const markup = navigationMarkup();

    expect([...markup.matchAll(/>(Inbox|Search|Tasks)</g)].map((match) => match[1])).toEqual([
        'Inbox',
        'Search',
        'Tasks',
    ]);
    expect(markup).toContain('haus-ghost--iridescent');
    // Outside an activity provider the Server reads as quiet, so the mesh
    // still drifts but keeps the calm tempo.
    expect(markup).toContain('haus-ghost--animated');
    expect(markup).not.toContain('haus-ghost--lively');
});

test('lets Inbox read at the same weight and x as Search and Tasks', () => {
    const markup = navigationMarkup();
    const inboxLabel = inboxLabelClasses(markup);

    // Inbox is an anchor, not an alert: the badge carries the urgency, so the
    // label keeps the menu's own weight rather than shouting beside it.
    expect(inboxLabel).not.toContain('font-semibold');
    expect(inboxLabel).not.toContain('font-medium');
    expect(inboxLabel).not.toContain('ms-');
});

test('badges Inbox with the Needs-you count in the Chat rows own chip', () => {
    const markup = navigationMarkup({ needsYouCount: 3 });

    expect(markup).toContain('aria-label="3 needs you"');
    // The same chip the unread counts wear, inside the row's own content, so
    // it lands in the trailing reserve the Settings gear floats over.
    expect(/data-sidebar="label"[^>]*>(?:(?!<\/li>).)*?3 needs you/s.test(markup)).toBe(true);
});

test('says nothing when nothing needs you', () => {
    expect(navigationMarkup({ needsYouCount: 0 })).not.toContain('needs you');
});

test('marks Inbox as the lead row, whose line the Settings gear floats over', () => {
    const markup = navigationMarkup();
    const shellCss = readFileSync(new URL('./shell.css', import.meta.url), 'utf8');
    const leadRows = markup.match(/app-shell-sidebar-lead-row/g) ?? [];

    // Exactly one: the reserve belongs to the row the gear overlaps, not to
    // the menu, or the rows below would truncate for a gear that is not there.
    expect(leadRows).toHaveLength(1);
    expect(markup.indexOf('app-shell-sidebar-lead-row')).toBeLessThan(markup.indexOf('>Search<'));
    // The reserve is the row part's own padding, so the row's fill still runs
    // the full width; macOS keeps HeroUI's padding, because the gear rides in
    // the titlebar strip above the navigation rather than over it.
    expect(shellCss).toMatch(
        /html:not\(\.macos-electron\)\s+\.app-shell-sidebar-lead-row\s+\.sidebar__menu-item-content/
    );
    expect(shellCss).toContain('--app-shell-settings-gear-size');
});

function inboxLabelClasses(markup: string): string {
    return (
        /<span class="([^"]*)" data-sidebar="label"[^>]*><span[^>]*>Inbox</.exec(markup)?.[1] ?? ''
    );
}

function navigationMarkup(options?: { needsYouCount?: number }) {
    return renderToStaticMarkup(
        <MemoryRouter>
            <CommandMenuProvider>
                <Sidebar.Provider>
                    <ShellSidebar activePage="server">
                        <ShellSidebarPage ariaLabel="Server" value="server">
                            <ChatNavigation
                                agents={[]}
                                chats={[]}
                                needsYouCount={options?.needsYouCount ?? 0}
                                onCreateChannel={() => undefined}
                                onPreloadSection={() => undefined}
                                selectedChatId={undefined}
                                serverId="server_one"
                                slug="haus"
                            />
                        </ShellSidebarPage>
                    </ShellSidebar>
                </Sidebar.Provider>
            </CommandMenuProvider>
        </MemoryRouter>
    );
}
