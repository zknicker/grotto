import type { HugeiconsIconProps } from '@hugeicons/react';
import {
    BrainIcon,
    Cancel01Icon,
    CompassIcon,
    DatabaseSyncIcon,
    InformationCircleIcon,
    Message01Icon,
    PackageIcon,
    ToolsIcon,
} from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import {
    Drawer,
    DrawerDescription,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
    DrawerTrigger,
} from '../../components/ui/drawer.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { formatTimestamp } from '../../lib/format.ts';
import { AccessEventLogEntry } from '../sessions/log/event-entry/access-entry.tsx';
import { ArtifactLogEntry } from '../sessions/log/event-entry/artifact-entry.tsx';
import { DeliveryLogEntry } from '../sessions/log/event-entry/delivery-entry.tsx';
import type { TranscriptRow } from './chat-transcript-model.ts';
import { ThinkingStep, ThinkingStepDetails } from './thinking-steps.tsx';

type StepIcon = HugeiconsIconProps['icon'];

type RuntimeNoticeRow = Extract<TranscriptRow, { kind: 'system'; systemKind: 'runtimeNotice' }>;
interface RuntimeNoticeSummary {
    description?: string;
    icon: StepIcon;
    label: string;
}

export function RuntimeNoticeEntry({ row }: { row: RuntimeNoticeRow }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const summary = getRuntimeNoticeSummary(row);

    return (
        <div className="relative w-full px-3 py-1">
            <div className="w-[min(80%,52rem)] min-w-0">
                <ThinkingStep
                    className="-ml-2.5 [&>div]:gap-1.5"
                    icon={summary.icon}
                    index={0}
                    isLast
                    label={
                        <RuntimeNoticeLabel
                            isOpen={isOpen}
                            onOpenChange={setIsOpen}
                            row={row}
                            summary={summary}
                        />
                    }
                />
            </div>
        </div>
    );
}

export function SystemStep({
    animateEnter,
    currentSessionKey,
    index,
    isLast,
    row,
}: {
    animateEnter?: boolean;
    currentSessionKey?: string | null;
    index: number;
    isLast: boolean;
    row: Extract<TranscriptRow, { kind: 'system' }>;
}) {
    const body = getSystemBody({ currentSessionKey, row });
    const summary = getSystemSummary(row);

    return (
        <ThinkingStep
            animateEnter={animateEnter}
            description={summary.description}
            icon={summary.icon}
            index={index}
            isLast={isLast}
            label={summary.label}
            showIcon={summary.showIcon}
        >
            {body ? <ThinkingStepDetails summary="Details">{body}</ThinkingStepDetails> : null}
        </ThinkingStep>
    );
}

function getSystemBody({
    currentSessionKey,
    row,
}: {
    currentSessionKey?: string | null;
    row: Extract<TranscriptRow, { kind: 'system' }>;
}) {
    switch (row.systemKind) {
        case 'accessEvent':
            return <AccessEventLogEntry entry={row} />;
        case 'artifact':
            return <ArtifactLogEntry entry={row} />;
        case 'delivery':
            return (
                <DeliveryLogEntry
                    currentSessionKey={currentSessionKey ?? row.delivery.parentSessionKey}
                    delivery={row.delivery}
                />
            );
        case 'runtimeNotice':
            return null;
        case 'thinking':
            return null;
        case 'turnStatus':
            return null;
    }
}

function getSystemSummary(row: Extract<TranscriptRow, { kind: 'system' }>): {
    description?: string;
    icon: StepIcon;
    label: string;
    showIcon?: boolean;
} {
    switch (row.systemKind) {
        case 'accessEvent':
            return { icon: ToolsIcon, label: 'Checked access' };
        case 'artifact':
            return { icon: PackageIcon, label: 'Captured artifact' };
        case 'delivery':
            return { icon: Message01Icon, label: 'Delivered update' };
        case 'runtimeNotice': {
            const summary = getRuntimeNoticeSummary(row);
            return {
                description: summary.description,
                icon: summary.icon,
                label: summary.label,
            };
        }
        case 'thinking':
            return {
                ...parseThinkingSummary(row.thinking.text),
                icon: BrainIcon,
                showIcon: false,
            };
        case 'turnStatus':
            return {
                icon: Cancel01Icon,
                label: row.turnStatus.text,
            };
    }
}

export function parseThinkingSummary(text: string): {
    description?: string;
    label: string;
} {
    const trimmed = text.trim();
    const titleMatch = /^\*\*([^*\n][^*\n]*?)\*\*\s*([\s\S]*)$/u.exec(trimmed);

    if (!titleMatch) {
        return {
            description: trimmed || undefined,
            label: 'Thinking',
        };
    }

    const label = titleMatch[1]?.trim();
    const description = titleMatch[2]?.trim();

    return {
        description: description || undefined,
        label: label || 'Thinking',
    };
}

function getRuntimeNoticeSummary(row: RuntimeNoticeRow): RuntimeNoticeSummary {
    switch (row.runtimeNotice.kind) {
        case 'auto_compaction':
            return {
                description: formatCompactionDescription(row.runtimeNotice.compactionCount),
                icon: DatabaseSyncIcon,
                label: row.runtimeNotice.title,
            };
        case 'new_session':
            return {
                description: row.runtimeNotice.sessionId ?? row.runtimeNotice.detail ?? undefined,
                icon: CompassIcon,
                label: row.runtimeNotice.title,
            };
        case 'status':
            return {
                description:
                    row.runtimeNotice.text === row.runtimeNotice.title
                        ? undefined
                        : row.runtimeNotice.text,
                icon: InformationCircleIcon,
                label: row.runtimeNotice.title,
            };
    }
}

function formatCompactionDescription(count: number | null | undefined) {
    return typeof count === 'number' ? `count ${count}` : undefined;
}

// Hover affordance for a turn that opened a fresh session: an icon button in
// the turn's header actions (beside copy and turn details) that opens the
// notice drawer, instead of a standalone row ahead of the reply.
export function SessionNoticeAction({
    className,
    row,
}: {
    className?: string;
    row: RuntimeNoticeRow;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const summary = getRuntimeNoticeSummary(row);

    return (
        <Drawer onOpenChange={setIsOpen} open={isOpen} position="right">
            <DrawerTrigger
                render={
                    <button
                        aria-label="Started a fresh session"
                        className={className}
                        title="Started a fresh session"
                        type="button"
                    />
                }
            >
                <Icon className="size-3.5" icon={summary.icon} strokeWidth={2} />
            </DrawerTrigger>
            {isOpen ? <RuntimeNoticeDrawer row={row} summary={summary} /> : null}
        </Drawer>
    );
}

function RuntimeNoticeLabel({
    isOpen,
    onOpenChange,
    row,
    summary,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    row: RuntimeNoticeRow;
    summary: RuntimeNoticeSummary;
}) {
    return (
        <Drawer onOpenChange={onOpenChange} open={isOpen} position="right">
            <DrawerTrigger
                render={
                    <button
                        className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 text-left hover:text-foreground"
                        type="button"
                    />
                }
            >
                <span className="truncate font-medium text-muted-foreground">{summary.label}</span>
            </DrawerTrigger>
            {isOpen ? <RuntimeNoticeDrawer row={row} summary={summary} /> : null}
        </Drawer>
    );
}

function RuntimeNoticeDrawer({
    row,
    summary,
}: {
    row: RuntimeNoticeRow;
    summary: RuntimeNoticeSummary;
}) {
    const details = runtimeNoticeDetails(row);

    return (
        <DrawerPopup className="max-w-xl" showCloseButton variant="inset">
            <DrawerHeader className="gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-muted">
                        <Icon
                            className="size-[18px] text-muted-foreground"
                            icon={summary.icon}
                            strokeWidth={1.6}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <DrawerTitle className="truncate">{summary.label}</DrawerTitle>
                        <DrawerDescription className="mt-1 truncate">
                            Runtime notice
                        </DrawerDescription>
                    </div>
                </div>
            </DrawerHeader>
            <DrawerPanel className="space-y-5">
                <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-muted px-3 py-2.5">
                    {details.map((detail) => (
                        <RuntimeNoticeMetaRow
                            key={detail.label}
                            label={detail.label}
                            value={detail.value}
                        />
                    ))}
                </div>
                {row.runtimeNotice.text ? (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <h3 className="font-medium text-foreground text-sm">
                                Raw engine notice
                            </h3>
                            <p className="max-w-[58ch] text-pretty text-muted-foreground text-sm">
                                Original engine text captured before Grotto rendered it as a runtime
                                notice.
                            </p>
                        </div>
                        <div className="rounded-md border border-border-subtle bg-muted px-3 py-2">
                            <code className="break-all font-mono text-code text-foreground leading-relaxed">
                                {row.runtimeNotice.text}
                            </code>
                        </div>
                    </div>
                ) : null}
            </DrawerPanel>
        </DrawerPopup>
    );
}

function RuntimeNoticeMetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-0 break-all text-foreground">{value}</span>
        </div>
    );
}

function runtimeNoticeDetails(row: RuntimeNoticeRow) {
    const details = [
        { label: 'Notice type', value: formatNoticeKind(row.runtimeNotice.kind) },
        { label: 'Timestamp', value: formatTimestamp(row.timestamp) },
    ];

    if (typeof row.runtimeNotice.compactionCount === 'number') {
        details.push({
            label: 'Count',
            value: String(row.runtimeNotice.compactionCount),
        });
    }

    return details;
}

function formatNoticeKind(kind: RuntimeNoticeRow['runtimeNotice']['kind']) {
    switch (kind) {
        case 'auto_compaction':
            return 'Auto-compaction';
        case 'new_session':
            return 'New session';
        case 'status':
            return 'Status';
    }
}
