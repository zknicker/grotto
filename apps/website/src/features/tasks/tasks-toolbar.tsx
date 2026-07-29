import { Plus } from '@hugeicons/core-free-icons';
import * as React from 'react';
import { Icon } from '../../components/ui/icon.tsx';
import { PaneTopbar } from '../../components/ui/pane.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { SearchInput } from '../../components/ui/primitives/search-input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../components/ui/select.tsx';
import type { LabelRecord } from '../../lib/trpc.tsx';
import { cn } from '../../lib/utils.ts';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelDot } from './label-chip.tsx';
import { ManageLabelsDialog } from './manage-labels-dialog.tsx';
import type { TaskAssigneeFilter, TaskLabelFilter } from './task-presentation.ts';

// Sentinel select value that opens the manage dialog instead of filtering.
const manageLabelsValue = 'manage:labels';

interface TasksToolbarProps {
    agents: AgentSelectOption[];
    assignee: TaskAssigneeFilter;
    children?: React.ReactNode;
    hideCreate?: boolean;
    label: TaskLabelFilter;
    labels: LabelRecord[];
    onAssigneeChange: (assignee: TaskAssigneeFilter) => void;
    onCreate: () => void;
    onLabelChange: (label: TaskLabelFilter) => void;
    onQueryChange: (query: string) => void;
    query: string;
}

// The filter row above the board: assignee and label filters, search, and
// New task. `children` renders right-aligned (the List/Board view toggle).
export function TasksToolbar({
    agents,
    assignee,
    children,
    hideCreate = false,
    label,
    labels,
    onAssigneeChange,
    onCreate,
    onLabelChange,
    onQueryChange,
    query,
}: TasksToolbarProps) {
    const [manageLabelsOpen, setManageLabelsOpen] = React.useState(false);

    return (
        <PaneTopbar className="no-drag">
            <Select
                onValueChange={(value) => {
                    if (value) {
                        onAssigneeChange(value as TaskAssigneeFilter);
                    }
                }}
                value={assignee}
            >
                <SelectTrigger aria-label="Filter by assignee" className="w-48">
                    <SelectValue>{assigneeFilterLabel(assignee, agents)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="anyone">Anyone</SelectItem>
                    <SelectItem value="me">Me</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {agents.map((agent) => (
                        <SelectItem key={agent.id} value={`agent:${agent.id}`}>
                            <AgentOptionLabel agent={agent} />
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                onValueChange={(value) => {
                    if (value === manageLabelsValue) {
                        setManageLabelsOpen(true);
                        return;
                    }
                    if (value) {
                        onLabelChange(value);
                    }
                }}
                value={label}
            >
                <SelectTrigger aria-label="Filter by label" className="w-40">
                    <SelectValue>{labelFilterValue(label, labels)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Any label</SelectItem>
                    {labels.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                            <span className="flex items-center gap-2">
                                <LabelDot color={candidate.color} />
                                {candidate.name}
                            </span>
                        </SelectItem>
                    ))}
                    <SelectItem value={manageLabelsValue}>
                        <span className="text-muted-foreground">Manage labels...</span>
                    </SelectItem>
                </SelectContent>
            </Select>
            <SearchInput
                aria-label="Search tasks"
                className="w-full max-w-96"
                name="task-search"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search tasks..."
                size="default"
                value={query}
            />
            {children}
            {hideCreate ? null : (
                <Button
                    className={cn('shrink-0', children ? null : 'ml-auto')}
                    onClick={onCreate}
                    type="button"
                    variant="secondary"
                >
                    <Icon aria-hidden="true" className="size-4" icon={Plus} />
                    New task
                </Button>
            )}

            <ManageLabelsDialog onOpenChange={setManageLabelsOpen} open={manageLabelsOpen} />
        </PaneTopbar>
    );
}

function labelFilterValue(label: TaskLabelFilter, labels: LabelRecord[]) {
    if (label === 'all') {
        return 'Any label';
    }

    const match = labels.find((candidate) => candidate.id === label);

    return match ? (
        <span className="flex items-center gap-2">
            <LabelDot color={match.color} />
            {match.name}
        </span>
    ) : (
        'Any label'
    );
}

function assigneeFilterLabel(assignee: TaskAssigneeFilter, agents: AgentSelectOption[]) {
    if (assignee === 'anyone') {
        return 'Anyone';
    }

    if (assignee === 'me') {
        return 'Me';
    }

    if (assignee === 'unassigned') {
        return 'Unassigned';
    }

    const agentId = assignee.slice('agent:'.length);
    const agent = agents.find((candidate) => candidate.id === agentId);

    return agent ? <AgentOptionLabel agent={agent} /> : agentId;
}
