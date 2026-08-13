import { Drawer } from '@heroui/react';
import type { AgentExecutionJournal } from '@tavern/api';
import * as React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { useAgentTurnActivityHistory } from '../../hooks/members/use-agent-activity-history.ts';
import { useAgentExecutionJournal } from '../../hooks/members/use-agent-execution-journal.ts';
import {
    formatAgentActivityEvent,
    getTurnJournalPresentation,
    shouldRequestExecutionJournal,
    type TurnDetailAccess,
} from '../members/agent-profile/agent-activity-model.ts';

export function ServerTurnDetailsDrawer({
    access,
    agentAvatarUrl,
    agentId,
    agentName,
    onOpenChange,
    open,
    runId,
    serverId,
}: {
    access: TurnDetailAccess;
    agentAvatarUrl?: string | null;
    agentId: string | null;
    agentName: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    runId: string | null;
    serverId: string;
}) {
    return (
        <TurnDetailsDrawer
            agentAvatarUrl={agentAvatarUrl}
            agentName={agentName}
            onOpenChange={onOpenChange}
            open={open}
        >
            <TurnActivitySummary agentId={agentId} runId={runId} serverId={serverId} />
            {access === 'journal' && agentId ? (
                <OwnerTurnJournal agentId={agentId} open={open} runId={runId} serverId={serverId} />
            ) : null}
        </TurnDetailsDrawer>
    );
}

function TurnDetailsDrawer({
    agentAvatarUrl,
    agentName,
    children,
    onOpenChange,
    open,
}: {
    agentAvatarUrl?: string | null;
    agentName: string;
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
            <Drawer.Content placement="right">
                <Drawer.Dialog>
                    <Drawer.CloseTrigger />
                    <Drawer.Header>
                        <div className="flex items-center gap-2.5">
                            <EntityAvatar name={agentName} size="lg" src={agentAvatarUrl} />
                            <div className="min-w-0">
                                <Drawer.Heading>Turn details</Drawer.Heading>
                                <p className="truncate text-muted text-sm">{agentName}</p>
                            </div>
                        </div>
                    </Drawer.Header>
                    <Drawer.Body>{children}</Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}

function TurnActivitySummary({
    agentId,
    runId,
    serverId,
}: {
    agentId: string | null;
    runId: string | null;
    serverId: string;
}) {
    const activity = useAgentTurnActivityHistory(serverId, agentId ?? 'agent_missing', runId);
    const events = activity.data?.events ?? [];

    return (
        <section className="grid gap-2">
            <h3 className="font-medium text-foreground text-sm">Activity summary</h3>
            {runId ? (
                activity.isPending ? (
                    <p className="text-muted text-sm">Loading activity summary...</p>
                ) : activity.error && events.length === 0 ? (
                    <p className="text-muted text-sm">Activity summary is unavailable right now.</p>
                ) : events.length === 0 ? (
                    <p className="text-muted text-sm">No semantic activity was recorded.</p>
                ) : (
                    <ol className="grid gap-2">
                        {events.map((event) => (
                            <li className="flex items-baseline gap-2 text-sm" key={event.id}>
                                <time
                                    className="shrink-0 text-muted text-xs tabular-nums"
                                    dateTime={event.occurredAt}
                                >
                                    {new Date(event.occurredAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </time>
                                <span className="text-foreground">
                                    {formatAgentActivityEvent(event)}
                                </span>
                            </li>
                        ))}
                    </ol>
                )
            ) : (
                <p className="text-muted text-sm">This message has no available turn identity.</p>
            )}
        </section>
    );
}

function OwnerTurnJournal({
    agentId,
    open,
    runId,
    serverId,
}: {
    agentId: string;
    open: boolean;
    runId: string | null;
    serverId: string;
}) {
    const { data, isPending, request, reset, status } = useAgentExecutionJournal();

    React.useEffect(() => {
        if (!open) {
            reset();
            return;
        }
        if (!(shouldRequestExecutionJournal({ access: 'journal', open, runId }) && runId)) {
            return;
        }

        void request({ agentId, runId, serverId });
    }, [agentId, open, request, reset, runId, serverId]);

    const presentation =
        status === 'success'
            ? getTurnJournalPresentation(data, runId)
            : status === 'error'
              ? {
                    description: 'The Computer did not return detailed activity.',
                    kind: 'unavailable' as const,
                    reason: 'timeout' as const,
                    title: 'Detailed activity unavailable',
                }
              : null;

    return (
        <section className="grid gap-2 border-separator border-t pt-4">
            <h3 className="font-medium text-foreground text-sm">Detailed execution</h3>
            {isPending ? (
                <p className="text-muted text-sm">Loading detailed activity...</p>
            ) : presentation?.kind === 'available' ? (
                <JournalContents journal={presentation.journal} />
            ) : presentation ? (
                <div className="grid gap-1">
                    <p className="font-medium text-foreground text-sm">{presentation.title}</p>
                    <p className="text-muted text-sm">{presentation.description}</p>
                </div>
            ) : (
                <p className="text-muted text-sm">Open this drawer to request detailed activity.</p>
            )}
        </section>
    );
}

function JournalContents({ journal }: { journal: AgentExecutionJournal }) {
    return (
        <div className="grid gap-3">
            <p className="text-muted text-sm">
                {journal.status === 'failed'
                    ? 'The turn failed after the recorded activity below.'
                    : journal.status === 'running'
                      ? 'The turn is still running.'
                      : 'Recorded tool activity from the Computer.'}
            </p>
            {journal.error !== undefined ? (
                <JournalValue label="Turn error" value={journal.error} />
            ) : null}
            {journal.tools.map((tool) => (
                <article
                    className="grid gap-1.5 rounded-lg bg-surface-secondary px-3 py-2"
                    key={tool.toolCallId}
                >
                    <div className="flex items-baseline justify-between gap-3">
                        <h4 className="min-w-0 truncate font-medium text-foreground text-sm">
                            {tool.toolName}
                        </h4>
                        <span className="shrink-0 text-muted text-sm">{tool.status}</span>
                    </div>
                    {tool.input !== undefined ? (
                        <JournalValue label="Input" value={tool.input} />
                    ) : null}
                    {tool.output !== undefined ? (
                        <JournalValue label="Output" value={tool.output} />
                    ) : null}
                    {tool.error !== undefined ? (
                        <JournalValue label="Error" value={tool.error} />
                    ) : null}
                    {tool.final ? <JournalValue label="Final" value={tool.final} /> : null}
                    {tool.preliminary ? (
                        <JournalValue label="Preliminary" value={tool.preliminary} />
                    ) : null}
                </article>
            ))}
        </div>
    );
}

function JournalValue({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="grid gap-0.5">
            <span className="text-muted text-sm">{label}</span>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1 font-mono text-muted text-xs">
                {formatJournalValue(value)}
            </pre>
        </div>
    );
}

function formatJournalValue(value: unknown) {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2) ?? String(value);
    } catch {
        return 'Value unavailable.';
    }
}
