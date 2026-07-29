import {
    Cancel01Icon,
    CancelCircleIcon,
    Flag03Icon,
    Tag01Icon,
    UserIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon } from '../../components/ui/icon.tsx';
import {
    Menu,
    MenuItem,
    MenuPopup,
    MenuSeparator,
    MenuTrigger,
} from '../../components/ui/menu.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import { toastManager } from '../../components/ui/toast.tsx';
import type { BulkTaskUpdate, BulkTaskUpdateResult } from '../../hooks/tasks/use-task-mutations.ts';
import type { LabelRecord } from '../../lib/trpc.tsx';
import { AgentOptionLabel, type AgentSelectOption } from '../agents/agent-option-label.tsx';
import { LabelDot } from './label-chip.tsx';
import {
    type TaskPriority,
    type TaskRecord,
    type TaskStatus,
    taskPriorityLabels,
    taskPriorityOrder,
    taskStatusIcons,
    taskStatusLabels,
    taskStatusOrder,
} from './task-presentation.ts';

interface TaskBulkActionsProps {
    agents: AgentSelectOption[];
    bulkUpdate: (updates: BulkTaskUpdate[]) => Promise<BulkTaskUpdateResult>;
    labels: LabelRecord[];
    onClear: () => void;
    selectedTasks: TaskRecord[];
}

// Floating action bar for a board multi-selection. Each action fans a single
// patch (or a per-task label union) across every selected task and reports
// partial failures via toast. Selection persists after an edit so several
// changes can chain; Clear or Escape dismisses it.
export function TaskBulkActions({
    agents,
    bulkUpdate,
    labels,
    onClear,
    selectedTasks,
}: TaskBulkActionsProps) {
    const reduceMotion = useReducedMotion();
    const count = selectedTasks.length;

    const run = async (updates: BulkTaskUpdate[], verb: string) => {
        const result = await bulkUpdate(updates);

        if (result.failed > 0) {
            toastManager.add({
                description: `${result.total - result.failed} of ${result.total} updated. Try again.`,
                title: `Couldn't ${verb} every task`,
                type: 'error',
            });
        }
    };

    const applyPatch = (patch: BulkTaskUpdate['patch'], verb: string) => {
        void run(
            selectedTasks.map((task) => ({ patch, taskId: task.id })),
            verb
        );
    };

    const addLabel = (labelId: string) => {
        void run(
            selectedTasks.map((task) => ({
                patch: {
                    labelIds: Array.from(
                        new Set([...task.labels.map((label) => label.id), labelId])
                    ),
                },
                taskId: task.id,
            })),
            'label'
        );
    };

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
            <AnimatePresence>
                <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="pointer-events-auto"
                    exit={{ opacity: 0, y: 8 }}
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    transition={{ bounce: 0, duration: 0.18, type: 'spring' }}
                >
                    <Elevated
                        className="flex items-center gap-1 rounded-lg border px-2 py-1.5"
                        offset={2}
                        shadowLevel={3}
                    >
                        <span className="px-2 font-medium text-sm tabular-nums">
                            {count} selected
                        </span>
                        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />

                        <BulkStatusMenu onSelect={(status) => applyPatch({ status }, 'update')} />
                        <BulkAssigneeMenu
                            agents={agents}
                            onSelect={(assigneeId) => applyPatch({ assigneeId }, 'assign')}
                        />
                        <BulkPriorityMenu
                            onSelect={(priority) => applyPatch({ priority }, 'update')}
                        />
                        <BulkLabelMenu labels={labels} onSelect={addLabel} />

                        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
                        <Button
                            onClick={() => applyPatch({ status: 'closed' }, 'close')}
                            size="sm"
                            type="button"
                            variant="destructive-ghost"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={CancelCircleIcon} />
                            Close
                        </Button>
                        <Button
                            aria-label="Clear selection"
                            onClick={onClear}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                        >
                            <Icon aria-hidden="true" className="size-4" icon={Cancel01Icon} />
                        </Button>
                    </Elevated>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function BulkMenuButton({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <MenuTrigger
            render={
                <Button size="sm" type="button" variant="ghost">
                    {children}
                    {label}
                </Button>
            }
        />
    );
}

function BulkStatusMenu({ onSelect }: { onSelect: (status: TaskStatus) => void }) {
    return (
        <Menu>
            <BulkMenuButton label="Status">
                <Icon aria-hidden="true" className="size-4" icon={taskStatusIcons.in_progress} />
            </BulkMenuButton>
            <MenuPopup align="center" side="top">
                {taskStatusOrder.map((status) => (
                    <MenuItem key={status} onClick={() => onSelect(status)}>
                        <Icon aria-hidden="true" icon={taskStatusIcons[status]} />
                        {taskStatusLabels[status]}
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkAssigneeMenu({
    agents,
    onSelect,
}: {
    agents: AgentSelectOption[];
    onSelect: (assigneeId: string | null) => void;
}) {
    return (
        <Menu>
            <BulkMenuButton label="Assignee">
                <Icon aria-hidden="true" className="size-4" icon={UserIcon} />
            </BulkMenuButton>
            <MenuPopup align="center" className="min-w-44" side="top">
                <MenuItem onClick={() => onSelect(null)}>Unassigned</MenuItem>
                <MenuItem onClick={() => onSelect('usr_tavern')}>You</MenuItem>
                {agents.length > 0 ? <MenuSeparator /> : null}
                {agents.map((agent) => (
                    <MenuItem key={agent.id} onClick={() => onSelect(agent.id)}>
                        <AgentOptionLabel agent={agent} />
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkPriorityMenu({ onSelect }: { onSelect: (priority: TaskPriority) => void }) {
    return (
        <Menu>
            <BulkMenuButton label="Priority">
                <Icon aria-hidden="true" className="size-4" icon={Flag03Icon} />
            </BulkMenuButton>
            <MenuPopup align="center" side="top">
                {taskPriorityOrder.map((priority) => (
                    <MenuItem key={priority} onClick={() => onSelect(priority)}>
                        {taskPriorityLabels[priority]}
                    </MenuItem>
                ))}
            </MenuPopup>
        </Menu>
    );
}

function BulkLabelMenu({
    labels,
    onSelect,
}: {
    labels: LabelRecord[];
    onSelect: (labelId: string) => void;
}) {
    return (
        <Menu>
            <BulkMenuButton label="Label">
                <Icon aria-hidden="true" className="size-4" icon={Tag01Icon} />
            </BulkMenuButton>
            <MenuPopup align="center" className="min-w-44" side="top">
                {labels.length > 0 ? (
                    labels.map((label) => (
                        <MenuItem key={label.id} onClick={() => onSelect(label.id)}>
                            <LabelDot color={label.color} />
                            <span className="truncate">{label.name}</span>
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem disabled>No labels yet</MenuItem>
                )}
            </MenuPopup>
        </Menu>
    );
}
