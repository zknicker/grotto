import { Badge, Drawer } from '@heroui/react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { formatShortTime, formatTimestamp } from '../../lib/format.ts';
import { isActivityItem } from './chat-transcript-activity-utils.ts';
import { groupAgentItems } from './chat-transcript-item-utils.ts';
import {
    getItemTimestamp,
    type TranscriptItem,
    type TranscriptTurnEntry,
} from './chat-transcript-model.ts';
import { AgentTurnSegment } from './chat-transcript-turn.tsx';
import { DrawerActivityGroup } from './chat-turn-drawer-activity.tsx';

/**
 * Full detail for one agent turn: every tool/work drawer, preamble and
 * intra-turn updates, and the streaming or final response. Opened from the
 * active status row — the transcript pane itself stays prose-only.
 */
export function ChatTurnDrawer({
    agentAvatarUrl = null,
    agentName,
    chatId,
    embeddedEvidence = false,
    entry,
    onOpenChange,
    open,
    turnActive = false,
}: {
    agentAvatarUrl?: string | null;
    agentName: string;
    chatId?: string;
    embeddedEvidence?: boolean;
    entry: TranscriptTurnEntry | null;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    turnActive?: boolean;
}) {
    return (
        <Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
            <Drawer.Content placement="right">
                <Drawer.Dialog>
                    <Drawer.CloseTrigger />
                    <ChatTurnDrawerHeader
                        agentAvatarUrl={agentAvatarUrl}
                        agentName={agentName}
                        entry={entry}
                        turnActive={turnActive}
                    />
                    <Drawer.Body>
                        {embeddedEvidence ? (
                            <ChatTurnItems
                                chatId={chatId}
                                items={entry?.items ?? []}
                                turnActive={turnActive}
                                turnStartedAt={entry?.timestamp ?? null}
                            />
                        ) : (
                            <ChatTurnBody chatId={chatId} entry={entry} turnActive={turnActive} />
                        )}
                    </Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    );
}

// The agent fronts their own turn: their avatar, with the turn's
// when/how-long/what at a glance beneath the name.
function ChatTurnDrawerHeader({
    agentAvatarUrl,
    agentName,
    entry,
    turnActive,
}: {
    agentAvatarUrl: string | null;
    agentName: string;
    entry: TranscriptTurnEntry | null;
    turnActive: boolean;
}) {
    const startedAt = entry?.timestamp ?? null;
    const duration = turnActive ? null : formatTurnDuration(entry);
    const metaParts = turnActive
        ? [startedAt ? `started ${formatShortTime(startedAt)}` : null]
        : [formatTurnDayTime(startedAt), duration];

    return (
        <Drawer.Header>
            <div className="flex items-center gap-2.5">
                <EntityAvatar name={agentName} size="lg" src={agentAvatarUrl} />
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Drawer.Heading>{agentName}</Drawer.Heading>
                    <p className="flex min-w-0 items-center gap-1.5 text-muted text-sm">
                        {turnActive ? (
                            <span className="flex shrink-0 items-center gap-1.5">
                                <Badge className="static transform-none" color="accent" size="sm" />
                                Working now
                            </span>
                        ) : null}
                        <span className="truncate">
                            {metaParts.filter(Boolean).join(' · ') ||
                                (turnActive ? 'Getting started' : 'Turn detail')}
                        </span>
                    </p>
                </div>
            </div>
        </Drawer.Header>
    );
}

// The drawer's data wiring: execution evidence is turn-scoped
// (specs/chat-timeline.md) — live turns read the run's streamed evidence,
// completed turns query chat.turn.evidence on demand.
export function ChatTurnBody({
    chatId,
    entry,
    turnActive = false,
}: {
    chatId?: string;
    entry: TranscriptTurnEntry | null;
    turnActive?: boolean;
}) {
    return (
        <ChatTurnItems
            chatId={chatId}
            items={entry?.items ?? []}
            turnActive={turnActive}
            turnStartedAt={entry?.timestamp ?? null}
        />
    );
}

// The drawer's turn rendering, exported separately so it stays testable
// without the drawer's portal or live stores.
export function ChatTurnItems({
    chatId,
    items,
    turnActive = false,
    turnStartedAt = null,
}: {
    chatId?: string;
    items: readonly TranscriptItem[];
    turnActive?: boolean;
    turnStartedAt?: string | null;
}) {
    const segments = groupAgentItems([...items]);

    if (segments.length === 0) {
        return <p className="text-muted text-sm">Nothing to show yet.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3 pt-2 pb-2">
            {segments.map((segment, index) =>
                segment.kind === 'activity' ? (
                    // Activity renders through the stock Pro AI components:
                    // ChatTool cards for tools, ChainOfThought for the rest.
                    <DrawerActivityGroup
                        chatId={chatId}
                        items={segment.items.filter(isActivityItem)}
                        key={segment.key}
                        turnActive={turnActive && index === segments.length - 1}
                    />
                ) : (
                    <AgentTurnSegment
                        chatId={chatId}
                        defaultOpenWorkGroups
                        key={segment.key}
                        segment={segment}
                        turnActive={turnActive && index === segments.length - 1}
                        turnCompletedAt={null}
                        turnStartedAt={turnStartedAt}
                        turnStopped={false}
                    />
                )
            )}
        </div>
    );
}

// "Today at 10:52 am" / "Yesterday at 4:03 pm" / "Jun 12, 4:03 PM"
function formatTurnDayTime(timestamp: string | null) {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const now = new Date();
    const startOfDay = (value: Date) =>
        new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

    if (dayDiff === 0) {
        return `Today at ${formatShortTime(timestamp)}`;
    }

    if (dayDiff === 1) {
        return `Yesterday at ${formatShortTime(timestamp)}`;
    }

    return formatTimestamp(timestamp);
}

// Wall-clock span from the turn's first to last item ("18s", "2m 05s").
function formatTurnDuration(entry: TranscriptTurnEntry | null) {
    if (!entry?.timestamp) {
        return null;
    }

    const start = Date.parse(entry.timestamp);
    let end = Number.NaN;

    for (let index = entry.items.length - 1; index >= 0; index -= 1) {
        const item = entry.items[index];
        const timestamp = item ? getItemTimestamp(item) : null;
        const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;

        if (!Number.isNaN(parsed)) {
            end = parsed;
            break;
        }
    }

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        return null;
    }

    const totalSeconds = Math.round((end - start) / 1000);

    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
