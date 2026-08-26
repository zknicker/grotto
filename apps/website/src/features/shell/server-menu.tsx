import { Button, Dropdown, Label, Separator } from '@heroui/react';
import {
    Analytics01Icon,
    ArchiveIcon,
    ArrowDown01Icon,
    Link01Icon,
    PlusSignIcon,
    UserMultiple02Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../components/ui/icon.tsx';
import { ServerMark } from '../../components/ui/server-mark.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';

export function ServerMenu({
    currentServer,
    onCreateServer,
    onJoinServer,
    onOpenArchived,
    onOpenMembers,
    onOpenUsage,
    onSwitchServer,
    servers,
}: {
    currentServer: ServerSummary;
    onCreateServer: () => void;
    onJoinServer: () => void;
    onOpenArchived: () => void;
    onOpenMembers: () => void;
    onOpenUsage: () => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    return (
        <Dropdown>
            <Button
                aria-label={`Switch Server (current: ${currentServer.slug})`}
                // Matched to the rows below on all three counts: the hover box
                // starts on their left edge, `rounded-2xl` gives it their hover
                // radius, and px-1 insets the mark by their icon inset so it
                // lands on the same axis and nests the same way.
                className="-ms-0.5 min-w-0 gap-2.5 rounded-2xl px-1"
                size="sm"
                variant="ghost"
            >
                <ServerMark name={currentServer.displayName || currentServer.slug} />
                <span className="min-w-0 truncate font-semibold text-sm">
                    {currentServer.displayName || currentServer.slug}
                </span>
                <Icon aria-hidden="true" className="text-muted" icon={ArrowDown01Icon} size={15} />
            </Button>
            <Dropdown.Popover placement="bottom start">
                <Dropdown.Menu
                    onAction={(key) => {
                        if (key === 'members') {
                            onOpenMembers();
                            return;
                        }
                        if (key === 'usage') {
                            onOpenUsage();
                            return;
                        }
                        if (key === 'archived-chats') {
                            onOpenArchived();
                            return;
                        }
                        if (key === 'create-server') {
                            onCreateServer();
                            return;
                        }
                        if (key === 'join-server') {
                            onJoinServer();
                            return;
                        }
                        const server = servers.find((candidate) => candidate.id === key);
                        if (server) {
                            onSwitchServer(server.slug);
                        }
                    }}
                >
                    {servers.map((server) => (
                        <Dropdown.Item
                            className="h-10"
                            id={server.id}
                            key={server.id}
                            textValue={server.displayName}
                        >
                            <ServerMark name={server.displayName || server.slug} />
                            <Label className="min-w-0 flex-1 truncate">{server.displayName}</Label>
                            <span className="shrink-0 text-muted text-sm">/{server.slug}</span>
                        </Dropdown.Item>
                    ))}
                    <Separator />
                    <Dropdown.Item id="members" textValue="Members">
                        <Icon
                            aria-hidden="true"
                            className="text-muted"
                            icon={UserMultiple02Icon}
                            size={16}
                        />
                        <Label>Members</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="usage" textValue="Usage">
                        <Icon
                            aria-hidden="true"
                            className="text-muted"
                            icon={Analytics01Icon}
                            size={16}
                        />
                        <Label>Usage</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="archived-chats" textValue="Archived chats">
                        <Icon
                            aria-hidden="true"
                            className="text-muted"
                            icon={ArchiveIcon}
                            size={16}
                        />
                        <Label>Archived chats</Label>
                    </Dropdown.Item>
                    <Separator />
                    <Dropdown.Item className="h-10" id="create-server" textValue="Create server">
                        <span className="grid size-8 shrink-0 place-items-center text-muted">
                            <Icon aria-hidden="true" icon={PlusSignIcon} size={16} />
                        </span>
                        <Label>Create server</Label>
                    </Dropdown.Item>
                    <Dropdown.Item className="h-10" id="join-server" textValue="Join server">
                        <span className="grid size-8 shrink-0 place-items-center text-muted">
                            <Icon aria-hidden="true" icon={Link01Icon} size={16} />
                        </span>
                        <Label>Join server</Label>
                    </Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );
}
