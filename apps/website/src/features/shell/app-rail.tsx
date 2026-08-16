import { Sidebar } from '@heroui-pro/react';
import { ComputerTerminal01Icon, Settings01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { RouteTabIcon } from './route-tab-presentation.tsx';
import { sidebarHeaderBandClassName } from './section-header.tsx';
import { ServerMenu } from './server-menu.tsx';

export type AppRailSection = 'chat' | 'computers' | 'members' | 'search' | 'settings' | 'tasks';

/**
 * Far-left icon rail: a permanently collapsed HeroUI Sidebar (icon mode),
 * server switcher on top (Raft pattern), section navigation below,
 * settings pinned to the bottom. Collapsed items get built-in tooltips.
 */
export function AppRail({
    active,
    canOperate,
    currentServer,
    onCreateServer,
    onJoinServer,
    onPreload,
    onSelect,
    onSwitchServer,
    servers,
}: {
    active: AppRailSection;
    canOperate: boolean;
    currentServer: ServerSummary;
    onCreateServer: () => void;
    onJoinServer: () => void;
    onPreload: (section: AppRailSection) => void;
    onSelect: (section: AppRailSection) => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    const items: {
        id: Exclude<AppRailSection, 'settings' | 'computers' | 'search'>;
        label: string;
    }[] = [
        { id: 'chat', label: 'Chat' },
        { id: 'tasks', label: 'Tasks' },
    ];
    items.push({ id: 'members', label: 'Members' });

    return (
        <Sidebar.Provider
            className="app-rail relative h-full min-h-0 w-auto shrink-0"
            collapsible="icon"
            open={false}
            toggleShortcut={false}
            variant="inset"
        >
            <Sidebar aria-label="App sections">
                <Sidebar.Header>
                    <div className={`${sidebarHeaderBandClassName} justify-center`}>
                        <ServerMenu
                            currentServer={currentServer}
                            onCreateServer={onCreateServer}
                            onJoinServer={onJoinServer}
                            onSwitchServer={onSwitchServer}
                            servers={servers}
                        />
                    </div>
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
                                onHoverStart={() => onPreload(item.id)}
                                textValue={item.label}
                                tooltip={item.label}
                            >
                                <Sidebar.MenuIcon
                                    className={
                                        active === item.id ? undefined : 'text-foreground/70'
                                    }
                                >
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
                                onHoverStart={() => onPreload('computers')}
                                textValue="Computers"
                                tooltip="Computers"
                            >
                                <Sidebar.MenuIcon
                                    className={
                                        active === 'computers' ? undefined : 'text-foreground/70'
                                    }
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4.5"
                                        icon={ComputerTerminal01Icon}
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
                            onHoverStart={() => onPreload('settings')}
                            textValue="Settings"
                            tooltip="Settings"
                        >
                            <Sidebar.MenuIcon
                                className={active === 'settings' ? undefined : 'text-foreground/70'}
                            >
                                <Icon
                                    aria-hidden="true"
                                    className="size-4.5"
                                    icon={Settings01Icon}
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
