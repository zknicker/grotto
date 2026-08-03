import type { HugeiconsIconProps } from '@hugeicons/react';
import type { ReactNode } from 'react';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { cn } from '../../../lib/utils.ts';
import { ToolDrawer } from '../../sessions/tools/tool-drawer.tsx';
import { formatToolDuration, hasErrorStatus } from '../../sessions/tools/tool-ui.ts';
import { useToolRowHoverItem } from '../tool-row-hover.ts';
import type { ToolStepRow } from './types.ts';

type ToolIcon = HugeiconsIconProps['icon'];
const inlineToolTargetMaxLength = 96;

export function ToolTimelineStep({
    animateEnter = false,
    chatId,
    children,
    icon,
    index,
    isLast,
    label,
    row,
}: {
    animateEnter?: boolean;
    chatId?: string;
    children?: ReactNode;
    icon: ToolIcon;
    index: number;
    isLast: boolean;
    label: ReactNode;
    row: ToolStepRow;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const sessionKey = row.sessionKey;
    const inspectLabel = `Inspect ${row.toolCall.label || row.toolCall.name || 'tool call'}`;
    const hoverItem = useToolRowHoverItem(index + 1);

    return (
        <div
            className={cn(
                'group/tool-step relative z-10 overflow-hidden',
                animateEnter && 'chat-step-enter'
            )}
            data-tool-row-hover-index={hoverItem.dataIndex}
            // The proximity rail measures offsets against the rows container,
            // so the registered element must be this outer row (its inner
            // button's offsetParent is the row itself).
            ref={hoverItem.ref}
        >
            {isLast ? null : <div className="absolute top-7 bottom-0 left-4 w-px bg-separator" />}
            <button
                aria-label={inspectLabel}
                className={cn(
                    'flex min-h-[var(--tool-row-min-h,1.75rem)] w-full min-w-0 cursor-default items-center gap-2 rounded-[var(--tool-row-hover-radius,var(--radius-md))] py-1.5 pr-2 pl-[var(--tool-row-inset,0.75rem)] text-left text-muted outline-none transition-none focus-visible:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
                    !hoverItem.hasSharedHover && 'hover:bg-surface-hover'
                )}
                onClick={() => setIsOpen(true)}
                title={inspectLabel}
                type="button"
            >
                <span className="-ml-1 flex size-4 shrink-0 items-center justify-center">
                    <Icon className="size-4 text-muted" icon={icon} strokeWidth={1.5} />
                </span>
                <span className="flex min-w-0 flex-1 items-center text-sm leading-5">{label}</span>
            </button>
            {chatId ? (
                <ToolDrawer
                    activityId={row.id}
                    chatId={chatId}
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                    source="chat"
                />
            ) : sessionKey && row.toolCall.callId ? (
                <ToolDrawer
                    isOpen={isOpen}
                    onOpenChange={setIsOpen}
                    sessionKey={sessionKey}
                    source="session"
                    toolCallId={row.toolCall.callId}
                />
            ) : null}
            {children ? <div className="ml-7">{children}</div> : null}
        </div>
    );
}

export function InlineToolLabel({
    target,
    verb,
    row,
}: {
    row: ToolStepRow;
    target: string;
    verb: string;
}) {
    const duration = formatToolDuration(row.startedAt, row.completedAt);
    const isRunning = isRunningToolRow(row);
    const visibleTarget = formatInlineToolTarget(target);

    return (
        <span
            className={cn(
                'inline-flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 leading-4',
                isRunning && 'thinking-indicator-text'
            )}
        >
            <span
                className={cn(
                    'shrink-0 font-medium',
                    isRunning ? null : getInlineToolVerbClassName(row)
                )}
            >
                {verb}
            </span>
            <span className={cn('truncate', isRunning ? null : 'text-muted')}>{visibleTarget}</span>
            {duration ? (
                <span className="shrink-0 font-mono text-muted/70 text-xs tabular-nums">
                    {duration}
                </span>
            ) : null}
        </span>
    );
}

export function getInlineToolVerbClassName(row: ToolStepRow) {
    if (hasErrorStatus(row.toolCall.status)) {
        return 'text-danger';
    }

    if (!row.completedAt) {
        return 'text-muted/70';
    }

    return 'text-muted';
}

export function getToolTarget(row: ToolStepRow) {
    return row.toolCall.summaryParts.join(' ') || row.toolCall.label || row.toolCall.name || 'tool';
}

function formatInlineToolTarget(target: string) {
    if (target.length <= inlineToolTargetMaxLength) {
        return target;
    }

    return `${target.slice(0, inlineToolTargetMaxLength - 3).trimEnd()}...`;
}

export function getToolFact(row: ToolStepRow, label: string) {
    return (
        row.toolCall.facts.find((fact) => fact.label.toLowerCase() === label.toLowerCase())
            ?.value ?? null
    );
}

function isRunningToolRow(row: ToolStepRow) {
    return !(row.completedAt || hasErrorStatus(row.toolCall.status));
}
