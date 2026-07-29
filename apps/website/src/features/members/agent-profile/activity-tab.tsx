import { Copy01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { SettingsGroup } from '../../../components/ui/settings-row.tsx';
import { Spinner } from '../../../components/ui/spinner.tsx';
import { toastManager } from '../../../components/ui/toast.tsx';
import { useAgentActivity } from '../../../hooks/agents/use-agent-activity.ts';
import { writeClipboardText } from '../../../lib/clipboard.ts';
import { cn } from '../../../lib/utils.ts';
import {
    type AgentActivityEntry,
    formatAgentActivityEntry,
    formatAgentActivityTime,
} from '../../chats/agent-activity-labels.ts';

export function AgentActivityTab({ agentId }: { agentId: string }) {
    const activity = useAgentActivity({ agentId, limit: 50 });
    const entries = activity.data?.entries ?? [];

    return (
        <div className="mx-auto w-full max-w-4xl py-6">
            <header className="mb-3 flex items-center justify-between gap-4 px-3">
                <h2 className="font-semibold text-base text-foreground">Activity diagnostics</h2>
                <Button
                    disabled={entries.length === 0}
                    onClick={() => void copyDiagnostics(entries)}
                    size="sm"
                    variant="outline"
                >
                    <Icon icon={Copy01Icon} />
                    Copy Diagnostic Info
                </Button>
            </header>
            {activity.isPending ? (
                <p className="flex items-center gap-2 px-3 py-8 text-muted-foreground text-sm">
                    <Spinner className="size-4" />
                    Loading activity...
                </p>
            ) : activity.isError && !activity.data ? (
                <p className="px-3 py-8 text-destructive text-sm">Could not load activity.</p>
            ) : entries.length === 0 ? (
                <p className="px-3 py-8 text-muted-foreground text-sm">No activity yet</p>
            ) : (
                <SettingsGroup>
                    <ul className="divide-y divide-border">
                        {entries.map((entry) => (
                            <ActivityRow
                                entry={entry}
                                key={`${entry.turnId ?? entry.at}-${entry.kind}`}
                            />
                        ))}
                    </ul>
                </SettingsGroup>
            )}
            {/* In-chat work evidence moves here when WS2 retires transcript work groups. */}
        </div>
    );
}

function ActivityRow({ entry }: { entry: AgentActivityEntry }) {
    const label = formatAgentActivityEntry(entry);
    const separateDetail = entry.detail && !label.includes(entry.detail) ? entry.detail : null;

    return (
        <li className="grid min-w-0 grid-cols-[5.5rem_auto_minmax(0,1fr)] items-baseline gap-2 px-3 py-2.5 text-sm">
            <time className="text-meta text-muted-foreground tabular-nums">
                {formatAgentActivityTime(entry.at)}
            </time>
            <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', activityDotClassName(entry.kind))}
            />
            <span className="min-w-0">
                <span className="text-foreground">{label}</span>
                {separateDetail ? (
                    <span className="ml-2 text-muted-foreground">{separateDetail}</span>
                ) : null}
            </span>
        </li>
    );
}

function activityDotClassName(kind: AgentActivityEntry['kind']) {
    switch (kind) {
        case 'failed':
            return 'bg-destructive';
        case 'completed':
            return 'bg-primary';
        case 'new_session':
        case 'stopped':
            return 'bg-muted-foreground';
        case 'message_received':
            return 'bg-accent ring-1 ring-border';
    }
}

async function copyDiagnostics(entries: AgentActivityEntry[]) {
    const text = entries
        .map((entry) =>
            [entry.at, formatAgentActivityEntry(entry), entry.detail].filter(Boolean).join(' · ')
        )
        .join('\n');

    try {
        await writeClipboardText(text);
        toastManager.add({ title: 'Diagnostic info copied', type: 'success' });
    } catch {
        toastManager.add({ title: 'Could not copy diagnostic info', type: 'error' });
    }
}
