import { Button, Description, Dropdown, Label, Separator, Tooltip } from '@heroui/react';
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
 * Far-left icon rail: server switcher on top (Raft pattern), section
 * navigation below, settings pinned to the bottom.
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
        <nav
            aria-label="App sections"
            className="app-shell-sidebar-top-inset flex h-full w-12 shrink-0 flex-col items-center gap-1 py-2"
        >
            <ServerSwitcher
                currentServer={currentServer}
                onManageServers={onManageServers}
                onSwitchServer={onSwitchServer}
                servers={servers}
            />
            <Separator className="my-1 w-6" />
            {items.map((item) => (
                <RailButton
                    isActive={active === item.id}
                    key={item.id}
                    label={item.label}
                    onPress={() => onSelect(item.id)}
                >
                    <RouteTabIcon className="size-4.5" tab={item.id} />
                </RailButton>
            ))}
            {canOperate ? (
                <RailButton
                    isActive={active === 'computers'}
                    label="Computers"
                    onPress={() => onSelect('computers')}
                >
                    <Icon aria-hidden="true" className="size-4.5" icon={ComputerIcon} size={20} />
                </RailButton>
            ) : null}
            <div className="flex-1" />
            <RailButton
                isActive={active === 'settings'}
                label="Settings"
                onPress={() => onSelect('settings')}
            >
                <Icon aria-hidden="true" className="size-4.5" icon={Setting07Icon} size={20} />
            </RailButton>
        </nav>
    );
}

function RailButton({
    children,
    isActive,
    label,
    onPress,
}: {
    children: React.ReactNode;
    isActive: boolean;
    label: string;
    onPress: () => void;
}) {
    return (
        <Tooltip delay={0}>
            <Button
                aria-label={label}
                isIconOnly
                onPress={onPress}
                size="sm"
                variant={isActive ? 'secondary' : 'ghost'}
            >
                {children}
            </Button>
            <Tooltip.Content placement="right">{label}</Tooltip.Content>
        </Tooltip>
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
                <span className="grid size-6 place-items-center rounded-lg bg-accent font-semibold text-accent-foreground text-xs">
                    {initial}
                </span>
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
