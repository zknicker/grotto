import { Button, Kbd } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { useIsDesktopApp } from '../../hooks/shell/use-is-desktop-app.ts';
import { useCommandMenu } from './command-menu-provider.tsx';

/**
 * The visible way into the command palette. It opens Cmd+K rather than
 * accepting text, so it is a button that names its own shortcut.
 *
 * The desktop App renders it as chrome in the window's titlebar, so it takes a
 * filled pill. The browser renders it as the first row of the sidebar's list,
 * so it uses the Sidebar menu anatomy — that is what puts its icon and its
 * shortcut on the same left and right edges as the rows beneath it.
 */
export function SidebarSearchTrigger({ onPreload }: { onPreload: () => void }) {
    const { open } = useCommandMenu();
    const isDesktopApp = useIsDesktopApp();

    if (isDesktopApp) {
        return (
            <div className="flex min-w-0 flex-1" onPointerEnter={onPreload}>
                <Button
                    className="justify-start rounded-full"
                    fullWidth
                    onPress={open}
                    size="sm"
                    variant="secondary"
                >
                    <Icon icon={Search01Icon} />
                    <span className="text-muted">Search</span>
                    <Kbd className="ms-auto">
                        <Kbd.Abbr keyValue="command" />
                        <Kbd.Content>K</Kbd.Content>
                    </Kbd>
                </Button>
            </div>
        );
    }

    return (
        <Sidebar.Menu aria-label="Search" className="w-full" onAction={open}>
            <Sidebar.MenuItem
                id="search"
                onHoverStart={onPreload}
                textValue="Search"
                tooltip="Search"
            >
                <Sidebar.MenuIcon>
                    <Icon aria-hidden="true" icon={Search01Icon} />
                </Sidebar.MenuIcon>
                <Sidebar.MenuItemContent>
                    <Sidebar.MenuLabel>Search</Sidebar.MenuLabel>
                    <Sidebar.MenuChip>
                        <Kbd>
                            <Kbd.Abbr keyValue="command" />
                            <Kbd.Content>K</Kbd.Content>
                        </Kbd>
                    </Sidebar.MenuChip>
                </Sidebar.MenuItemContent>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    );
}
