import { Button, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { ComputerIcon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/icon.tsx';
import { StatusDot } from '../../components/ui/status-dot.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { serverComputersRoute } from '../servers/server-routes.ts';
import { AddComputerDialog } from './add-computer-dialog.tsx';
import { computerHealthLabel, computerHealthStatus } from './computer-detail.tsx';
import { computerLabel } from './presentation.ts';

/** Computers section sidebar: the attached-Computer roster as navigation. */
export function ComputersSidebar({ serverId, slug }: { serverId: string; slug: string }) {
    const computers = grottoTrpc.computer.list.useQuery({ serverId }, { enabled: true });
    const [searchParams] = useSearchParams();
    const [adding, setAdding] = React.useState(false);
    const items = computers.data ?? [];
    const selectedId = searchParams.get('computer') ?? items[0]?.id;
    const route = serverComputersRoute(slug);

    return (
        <Sidebar aria-label="Computers">
            <Sidebar.Header>
                <div className="px-2 py-1 font-semibold text-sm">Computers</div>
            </Sidebar.Header>
            <Sidebar.Content>
                <Sidebar.Group>
                    <div className="flex items-center justify-between pe-1">
                        <Sidebar.GroupLabel>
                            Attached{computers.data ? ` · ${items.length}` : ''}
                        </Sidebar.GroupLabel>
                        <Tooltip delay={0}>
                            <Button
                                aria-label="Add Computer"
                                isIconOnly
                                onPress={() => setAdding(true)}
                                size="sm"
                                variant="ghost"
                            >
                                <Icon aria-hidden="true" icon={PlusSignIcon} size={16} />
                            </Button>
                            <Tooltip.Content>Add Computer</Tooltip.Content>
                        </Tooltip>
                    </div>
                    {items.length === 0 ? (
                        <p className="px-2 py-1 text-muted text-sm">No Computers attached.</p>
                    ) : (
                        <Sidebar.Menu aria-label="Computers">
                            {items.map((computer) => (
                                <Sidebar.MenuItem
                                    href={`${route}?computer=${computer.id}`}
                                    id={computer.id}
                                    isCurrent={computer.id === selectedId}
                                    key={computer.id}
                                    textValue={computerLabel(computer)}
                                >
                                    <Sidebar.MenuIcon>
                                        <span className="relative flex size-5 shrink-0 items-center justify-center">
                                            <Icon
                                                aria-hidden="true"
                                                className="size-4 text-muted"
                                                icon={ComputerIcon}
                                            />
                                            <StatusDot
                                                className="absolute right-0 bottom-0"
                                                size="md"
                                                status={computerHealthStatus(computer.health)}
                                                title={computerHealthLabel(computer.health)}
                                            />
                                        </span>
                                    </Sidebar.MenuIcon>
                                    <Sidebar.MenuItemContent>
                                        <Sidebar.MenuLabel>
                                            {computerLabel(computer)}
                                        </Sidebar.MenuLabel>
                                        <Sidebar.MenuChip>
                                            v{computer.productVersion ?? '—'}
                                        </Sidebar.MenuChip>
                                    </Sidebar.MenuItemContent>
                                </Sidebar.MenuItem>
                            ))}
                        </Sidebar.Menu>
                    )}
                </Sidebar.Group>
            </Sidebar.Content>
            <AddComputerDialog onOpenChange={setAdding} open={adding} serverSlug={slug} />
        </Sidebar>
    );
}
