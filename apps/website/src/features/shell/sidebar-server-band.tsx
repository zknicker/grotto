import { Button, Tooltip } from '@heroui/react';
import { ArrowLeft01Icon, Settings01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { bandHeightClassName, shellBandIconSize } from './section-header.tsx';
import { ServerMenu } from './server-menu.tsx';

/**
 * The sidebar's leading row: the server switcher on the leading edge,
 * settings on the trailing one — the Linear workspace-row pattern. It fills
 * the shared shell band height so its midline matches the content topbar
 * across the divider, and the sidebar bottom stays reserved for live agent
 * activity.
 *
 * On the macOS desktop the settings action lifts out of this row into the
 * titlebar strip beside the traffic lights, which is otherwise reserved space
 * doing nothing. `shell.css` owns that move — the strip only exists there —
 * and this row keeps one markup shape for both surfaces. The switcher then has
 * the whole row, which is the width a long Server name needs.
 */
export function SidebarServerBand({
    currentServer,
    onCreateServer,
    onJoinServer,
    onOpenArchived,
    onOpenMembers,
    onOpenUsage,
    onOpenSettings,
    onPreloadSettings,
    onSwitchServer,
    servers,
}: {
    currentServer: ServerSummary;
    onCreateServer: () => void;
    onJoinServer: () => void;
    onOpenArchived: () => void;
    onOpenMembers: () => void;
    onOpenUsage: () => void;
    onOpenSettings: () => void;
    onPreloadSettings: () => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    return (
        <div className={`flex ${bandHeightClassName} min-w-0 shrink-0 items-center gap-1 px-3`}>
            <div className="min-w-0 flex-1">
                <ServerMenu
                    currentServer={currentServer}
                    onCreateServer={onCreateServer}
                    onJoinServer={onJoinServer}
                    onOpenArchived={onOpenArchived}
                    onOpenMembers={onOpenMembers}
                    onOpenUsage={onOpenUsage}
                    onSwitchServer={onSwitchServer}
                    servers={servers}
                />
            </div>
            <div className="app-shell-titlebar-action flex items-center">
                <Tooltip>
                    <Button
                        aria-label="Settings"
                        isIconOnly
                        onHoverStart={onPreloadSettings}
                        onPress={onOpenSettings}
                        size="sm"
                        variant="ghost"
                    >
                        <Icon
                            aria-hidden="true"
                            className="text-muted"
                            icon={Settings01Icon}
                            size={shellBandIconSize}
                        />
                    </Button>
                    <Tooltip.Content>Settings</Tooltip.Content>
                </Tooltip>
            </div>
        </div>
    );
}

/**
 * Escape hatch for sidebar pages that replace the chat navigation (settings,
 * tasks, members, computers): one quiet row back to the last-open chat.
 */
export function SidebarBackToChatRow({ route }: { route: string }) {
    return (
        <div className="px-3">
            <Link
                className="-mx-2 flex cursor-[var(--cursor-interactive)] items-center gap-2 rounded-lg px-2 py-1.5 text-muted text-sm hover:bg-surface-hover hover:text-foreground"
                to={route}
            >
                <Icon aria-hidden="true" icon={ArrowLeft01Icon} size={15} />
                Back to chat
            </Link>
        </div>
    );
}
