import { Avatar, Button, Description, Dropdown, Label } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { ComputerIcon, Setting07Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { RouteTabIcon } from './route-tab-presentation.tsx';

export type AppRailSection =
    | 'activity'
    | 'chat'
    | 'computers'
    | 'members'
    | 'reminders'
    | 'search'
    | 'settings'
    | 'tasks';

/**
 * Far-left icon rail: a permanently collapsed HeroUI Sidebar (icon mode),
 * server switcher on top (Raft pattern), section navigation below,
 * settings pinned to the bottom. Collapsed items get built-in tooltips.
 */
export function AppRail({
    active,
    canOperate,
    currentServer,
    onManageServers,
    onSelect,
    onSwitchServer,
    servers,
}: {
    active: AppRailSection;
    canOperate: boolean;
    currentServer: ServerSummary;
    onManageServers: () => void;
    onSelect: (section: AppRailSection) => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    const items: { id: Exclude<AppRailSection, 'settings' | 'computers'>; label: string }[] = [
        { id: 'search', label: 'Search' },
        { id: 'chat', label: 'Chat' },
        { id: 'activity', label: 'Activity' },
        { id: 'tasks', label: 'Tasks' },
    ];
    if (canOperate) {
        items.push({ id: 'reminders', label: 'Reminders' });
    }
    items.push({ id: 'members', label: 'Members' });

    return (
        <Sidebar.Provider
            className="h-full min-h-0 w-auto shrink-0"
            collapsible="icon"
            open={false}
            toggleShortcut={false}
        >
            <Sidebar aria-label="App sections">
                <Sidebar.Header>
                    <ServerSwitcher
                        currentServer={currentServer}
                        onManageServers={onManageServers}
                        onSwitchServer={onSwitchServer}
                        servers={servers}
                    />
                </Sidebar.Header>
                <Sidebar.Content>
                    <Sidebar.Menu
                        aria-label="Sections"
                        onAction={(key) => onSelect(key as AppRailSection)}
                    >
                        {items.map((item) => (
                            <Sidebar.MenuItem
                                id={item.id}
                                isCurrent={active === item.id}
                                key={item.id}
                                textValue={item.label}
                                tooltip={item.label}
                            >
                                <Sidebar.MenuIcon>
                                    <RouteTabIcon className="size-4.5" tab={item.id} />
                                </Sidebar.MenuIcon>
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ))}
                        {canOperate ? (
                            <Sidebar.MenuItem
                                id="computers"
                                isCurrent={active === 'computers'}
                                textValue="Computers"
                                tooltip="Computers"
                            >
                                <Sidebar.MenuIcon>
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4.5"
                                        icon={ComputerIcon}
                                        size={20}
                                    />
                                </Sidebar.MenuIcon>
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>Computers</Sidebar.MenuLabel>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ) : null}
                    </Sidebar.Menu>
                </Sidebar.Content>
                <Sidebar.Footer>
                    <Sidebar.Menu aria-label="Settings" onAction={() => onSelect('settings')}>
                        <Sidebar.MenuItem
                            id="settings"
                            isCurrent={active === 'settings'}
                            textValue="Settings"
                            tooltip="Settings"
                        >
                            <Sidebar.MenuIcon>
                                <Icon
                                    aria-hidden="true"
                                    className="size-4.5"
                                    icon={Setting07Icon}
                                    size={20}
                                />
                            </Sidebar.MenuIcon>
                            <Sidebar.MenuItemContent>
                                <Sidebar.MenuLabel>Settings</Sidebar.MenuLabel>
                            </Sidebar.MenuItemContent>
                        </Sidebar.MenuItem>
                    </Sidebar.Menu>
                </Sidebar.Footer>
            </Sidebar>
        </Sidebar.Provider>
    );
}

function ServerSwitcher({
    currentServer,
    onManageServers,
    onSwitchServer,
    servers,
}: {
    currentServer: ServerSummary;
    onManageServers: () => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    const initial = (currentServer.displayName || currentServer.slug).slice(0, 1).toUpperCase();
    return (
        <Dropdown>
            <Button
                aria-label={`Switch Server (current: ${currentServer.slug})`}
                isIconOnly
                variant="ghost"
            >
                <Avatar className="size-6">
                    <Avatar.Fallback>{initial}</Avatar.Fallback>
                </Avatar>
            </Button>
            <Dropdown.Popover placement="right top">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === 'manage-servers') {
                            onManageServers();
                            return;
                        }
                        onSwitchServer(String(key));
                    }}
                >
                    {servers.map((server) => (
                        <Dropdown.Item
                            id={server.slug}
                            key={server.id}
                            textValue={server.displayName}
                        >
                            <Label>{server.displayName}</Label>
                            <Description>/{server.slug}</Description>
                        </Dropdown.Item>
                    ))}
                    <Dropdown.Item id="manage-servers" textValue="Switch or create Server">
                        <Label>Switch or create Server…</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
