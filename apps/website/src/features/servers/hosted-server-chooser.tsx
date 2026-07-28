import {
    Add01Icon,
    ArrowDown01Icon,
    ServerStack01Icon,
    Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../../components/ui/sidebar.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { ServerChoicePanel } from './server-choice-panel.tsx';
import { serverRoute } from './server-routes.ts';

export function HostedServerChooser({
    currentServer,
    servers,
}: {
    currentServer: ServerSummary | null;
    servers: ServerSummary[];
}) {
    const navigate = useNavigate();
    const [manageOpen, setManageOpen] = React.useState(false);
    const currentLabel = currentServer?.slug ?? 'none';

    return (
        <>
            <SidebarGroup className="shrink-0 pt-0 pb-0">
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <Menu>
                                <MenuTrigger
                                    render={
                                        <SidebarMenuButton
                                            aria-label={`Switch Server (current: ${currentLabel})`}
                                            className="h-auto min-h-10 py-1.5"
                                        />
                                    }
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="shrink-0"
                                        icon={ServerStack01Icon}
                                        size={18}
                                    />
                                    <span className="min-w-0 flex-1 text-left">
                                        <span className="block truncate font-semibold text-sm">
                                            {currentServer?.displayName ?? 'No Server'}
                                        </span>
                                        <span className="block truncate text-meta text-sidebar-muted">
                                            {currentServer
                                                ? `/${currentServer.slug}`
                                                : 'Get started'}
                                        </span>
                                    </span>
                                    <Icon
                                        aria-hidden="true"
                                        className="shrink-0 text-sidebar-muted"
                                        icon={ArrowDown01Icon}
                                        size={14}
                                    />
                                </MenuTrigger>
                                <MenuPopup align="start" className="w-64">
                                    {servers.map((server) => (
                                        <MenuItem
                                            key={server.id}
                                            onClick={() => navigate(serverRoute(server.slug))}
                                        >
                                            <Icon
                                                aria-hidden="true"
                                                className={
                                                    server.id === currentServer?.id
                                                        ? undefined
                                                        : 'opacity-0'
                                                }
                                                icon={Tick02Icon}
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate">
                                                    {server.displayName}
                                                </span>
                                                <span className="block truncate text-meta text-muted-foreground">
                                                    /{server.slug}
                                                </span>
                                            </span>
                                        </MenuItem>
                                    ))}
                                    {servers.length > 0 ? <MenuSeparator /> : null}
                                    <MenuItem onClick={() => setManageOpen(true)}>
                                        <Icon aria-hidden="true" icon={Add01Icon} />
                                        <span>Switch or Create Server</span>
                                    </MenuItem>
                                </MenuPopup>
                            </Menu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
            <Dialog onOpenChange={setManageOpen} open={manageOpen}>
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>Servers</DialogTitle>
                        <DialogDescription>
                            Switch to a joined Server, create one, or accept an invitation.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogPanel className="overflow-y-auto">
                        <ServerChoicePanel
                            onServerSelect={() => setManageOpen(false)}
                            servers={servers}
                        />
                    </DialogPanel>
                </DialogContent>
            </Dialog>
        </>
    );
}
