import { Button, Dropdown, Label, Separator } from '@heroui/react';
import { Link01Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { ServerSummary } from '../../lib/grotto-server.tsx';

export function ServerMenu({
    currentServer,
    onCreateServer,
    onJoinServer,
    onSwitchServer,
    servers,
}: {
    currentServer: ServerSummary;
    onCreateServer: () => void;
    onJoinServer: () => void;
    onSwitchServer: (slug: string) => void;
    servers: ServerSummary[];
}) {
    return (
        <Dropdown>
            <Button
                aria-label={`Switch Server (current: ${currentServer.slug})`}
                isIconOnly
                variant="ghost"
            >
                {/* The Server wears the same mark as its Agents and people. */}
                <EntityAvatar name={currentServer.displayName || currentServer.slug} size="sm" />
            </Button>
            <Dropdown.Popover placement="right top">
                <Dropdown.Menu
                    onAction={(key) => {
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
                            <EntityAvatar name={server.displayName || server.slug} size="sm" />
                            <Label className="min-w-0 flex-1 truncate">{server.displayName}</Label>
                            <span className="shrink-0 text-muted text-sm">/{server.slug}</span>
                        </Dropdown.Item>
                    ))}
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
