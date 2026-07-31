import { Button, SearchField, Tooltip } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { Edit02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../../components/ui/icon.tsx';
import { useServerTaskLabels } from '../../../hooks/servers/use-server-task-labels.ts';
import { useServerTasks } from '../../../hooks/servers/use-server-tasks.ts';
import { LabelDot } from '../../tasks/label-chip.tsx';
import { serverTasksRoute } from '../server-routes.ts';
import { ServerTaskLabelsDialog } from './server-task-labels-dialog.tsx';
import {
    filterServerTasks,
    type ServerTask,
    type ServerTaskView,
    toServerTask,
} from './server-task-presentation.ts';

const views: Array<{ label: string; value: ServerTaskView }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Unassigned', value: 'unassigned' },
];

/**
 * Tasks section sidebar (Tracker pattern): views and label filters as
 * navigation over URL search params, so the surface stays stateless about
 * filter selection. Shares the tasks/labels queries with the surface via
 * the query cache.
 */
export function ServerTasksSidebar({
    canManage,
    serverId,
    slug,
}: {
    canManage: boolean;
    serverId: string;
    slug: string;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [labelsOpen, setLabelsOpen] = React.useState(false);
    const tasksQuery = useServerTasks(serverId);
    const labelsQuery = useServerTaskLabels(serverId);
    const tasks = React.useMemo(() => tasksQuery.data?.map(toServerTask) ?? [], [tasksQuery.data]);

    const activeView = resolveTaskView(searchParams.get('view'));
    const activeLabel = searchParams.get('label');
    const route = serverTasksRoute(slug);
    const viewHref = (view: ServerTaskView) =>
        taskFilterHref(route, view, activeLabel ?? undefined);
    const labelHref = (labelId?: string) => taskFilterHref(route, activeView, labelId);

    return (
        <Sidebar aria-label="Tasks">
            <Sidebar.Header>
                <SearchField
                    aria-label="Search tasks"
                    onChange={(value) => {
                        setSearchParams(
                            (params) => {
                                const next = new URLSearchParams(params);
                                if (value) {
                                    next.set('q', value);
                                } else {
                                    next.delete('q');
                                }
                                return next;
                            },
                            { replace: true }
                        );
                    }}
                    value={searchParams.get('q') ?? ''}
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search tasks..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
            </Sidebar.Header>
            <Sidebar.Content>
                <Sidebar.Group>
                    <Sidebar.GroupLabel>Views</Sidebar.GroupLabel>
                    <Sidebar.Menu aria-label="Task views">
                        {views.map((view) => (
                            <Sidebar.MenuItem
                                href={viewHref(view.value)}
                                id={view.value}
                                isCurrent={view.value === activeView}
                                key={view.value}
                                textValue={view.label}
                            >
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>{view.label}</Sidebar.MenuLabel>
                                    <Sidebar.MenuChip>
                                        {countForView(tasks, view.value)}
                                    </Sidebar.MenuChip>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                        ))}
                    </Sidebar.Menu>
                </Sidebar.Group>
                {(labelsQuery.data && labelsQuery.data.length > 0) || canManage ? (
                    <Sidebar.Group>
                        <div className="flex items-center justify-between pe-1">
                            <Sidebar.GroupLabel>Labels</Sidebar.GroupLabel>
                            {canManage ? (
                                <Tooltip delay={0}>
                                    <Button
                                        aria-label="Manage Labels"
                                        isIconOnly
                                        onPress={() => setLabelsOpen(true)}
                                        size="sm"
                                        variant="ghost"
                                    >
                                        <Icon aria-hidden="true" icon={Edit02Icon} size={14} />
                                    </Button>
                                    <Tooltip.Content>Manage Labels</Tooltip.Content>
                                </Tooltip>
                            ) : null}
                        </div>
                        <Sidebar.Menu aria-label="Label filters">
                            <Sidebar.MenuItem
                                href={labelHref(undefined)}
                                id="all-labels"
                                isCurrent={activeLabel === null}
                                textValue="All Labels"
                            >
                                <Sidebar.MenuItemContent>
                                    <Sidebar.MenuLabel>All Labels</Sidebar.MenuLabel>
                                </Sidebar.MenuItemContent>
                            </Sidebar.MenuItem>
                            {(labelsQuery.data ?? []).map((label) => (
                                <Sidebar.MenuItem
                                    href={labelHref(label.id)}
                                    id={label.id}
                                    isCurrent={label.id === activeLabel}
                                    key={label.id}
                                    textValue={label.name}
                                >
                                    <Sidebar.MenuIcon>
                                        <LabelDot color={label.color} />
                                    </Sidebar.MenuIcon>
                                    <Sidebar.MenuItemContent>
                                        <Sidebar.MenuLabel>{label.name}</Sidebar.MenuLabel>
                                        <Sidebar.MenuChip>
                                            {countForLabel(tasks, label.id)}
                                        </Sidebar.MenuChip>
                                    </Sidebar.MenuItemContent>
                                </Sidebar.MenuItem>
                            ))}
                        </Sidebar.Menu>
                    </Sidebar.Group>
                ) : null}
            </Sidebar.Content>
            <ServerTaskLabelsDialog
                canManage={canManage}
                labels={labelsQuery.data ?? []}
                onOpenChange={setLabelsOpen}
                open={labelsOpen}
                serverId={serverId}
            />
        </Sidebar>
    );
}

export function resolveTaskView(value: string | null): ServerTaskView {
    return value === 'active' || value === 'unassigned' ? value : 'all';
}

function taskFilterHref(route: string, view: ServerTaskView, labelId?: string) {
    const params = new URLSearchParams();
    if (view !== 'all') {
        params.set('view', view);
    }
    if (labelId) {
        params.set('label', labelId);
    }
    const suffix = params.toString();
    return suffix ? `${route}?${suffix}` : route;
}

function countForView(tasks: ServerTask[], view: ServerTaskView) {
    return filterServerTasks(tasks, { query: '', view }).length;
}

function countForLabel(tasks: ServerTask[], labelId: string) {
    return tasks.filter((task) => task.labels.some((label) => label.id === labelId)).length;
}
