import { Drawer } from '@heroui/react';
import { useReducedMotion } from 'framer-motion';
import { useDevMode } from '../../components/dev-mode-provider.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { useChatTurnPrompt } from '../../hooks/chats/use-chat-turn-prompt.ts';
import { formatShortTime, formatTimestamp } from '../../lib/format.ts';
import { trpc } from '../../lib/trpc.tsx';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace, type HeadName } from './agent-face.tsx';
import { groupAgentItems } from './chat-transcript-item-utils.ts';
import {
    getItemRunId,
    getItemTimestamp,
    type TranscriptItem,
    type TranscriptTurnEntry,
} from './chat-transcript-model.ts';
import { AgentTurnSegment } from './chat-transcript-turn.tsx';

const faceStyle = { flexShrink: 0, overflow: 'visible' } as const;

/**
 * Full detail for one agent turn: every tool/work drawer, preamble and
 * intra-turn updates, and the streaming or final response. Opened from the
 * active status row — the transcript pane itself stays prose-only.
 */
export function ChatTurnDrawer({
    agentCharacter = null,
    agentColor = null,
    agentName,
    chatId,
    embeddedEvidence = false,
    entry,
    onOpenChange,
    open,
    turnActive = false,
}: {
    agentCharacter?: HeadName | null;
    agentColor?: string | null;
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
                        agentCharacter={agentCharacter}
                        agentColor={agentColor}
                        agentName={agentName}
                        entry={entry}
                        turnActive={turnActive}
                    />
                    <Drawer.Body>
                        {embeddedEvidence ? (
                            <ChatTurnItems
                                chatId={chatId}
                                items={entry?.items ?? []}
                                showPromptEvidence={false}
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

// The agent fronts their own turn: a large living face on a soft wash of
// their color, with the turn's when/how-long/what at a glance beneath the
// name.
function ChatTurnDrawerHeader({
    agentCharacter,
    agentColor,
    agentName,
    entry,
    turnActive,
}: {
    agentCharacter: HeadName | null;
    agentColor: string | null;
    agentName: string;
    entry: TranscriptTurnEntry | null;
    turnActive: boolean;
}) {
    const dark = useResolvedThemeOptional() === 'dark';
    const shouldReduceMotion = useReducedMotion();
    const startedAt = entry?.timestamp ?? null;
    const duration = turnActive ? null : formatTurnDuration(entry);
    const metaParts = turnActive
        ? [startedAt ? `started ${formatShortTime(startedAt)}` : null]
        : [formatTurnDayTime(startedAt), duration];

    return (
        <Drawer.Header>
            <div className="flex items-center gap-2.5">
                <div className="flex size-11 shrink-0 items-center justify-center">
                    <AgentFace
                        blinking={!shouldReduceMotion}
                        dark={dark}
                        head={agentCharacter ?? 'none'}
                        ink={resolveAgentInk(dark, agentColor)}
                        intensity={turnActive ? 1 : 0.92}
                        size={40}
                        speed={shouldReduceMotion ? 0.35 : turnActive ? 1.05 : 0.78}
                        style={faceStyle}
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Drawer.Heading>{agentName}</Drawer.Heading>
                    <p className="flex min-w-0 items-center gap-1.5 text-muted text-sm">
                        {turnActive ? (
                            <span className="flex shrink-0 items-center gap-1.5">
                                <span aria-hidden className="relative flex size-2">
                                    <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                                    <span className="relative inline-flex size-2 rounded-full bg-accent" />
                                </span>
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
    const evidenceItems = useTurnEvidenceItems({
        chatId: chatId ?? null,
        responseId: entry?.responseId ?? null,
        turnActive,
    });
    const items = mergeTurnItems(evidenceItems, entry?.items ?? []);

    return (
        <ChatTurnItems
            chatId={chatId}
            items={items}
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
    showPromptEvidence = true,
    turnActive = false,
    turnStartedAt = null,
}: {
    chatId?: string;
    items: readonly TranscriptItem[];
    showPromptEvidence?: boolean;
    turnActive?: boolean;
    turnStartedAt?: string | null;
}) {
    const runId = items.map(getItemRunId).find((value) => value !== null) ?? null;
    const segments = groupAgentItems([...items]);

    if (segments.length === 0) {
        return <p className="text-muted text-sm">Nothing to show yet.</p>;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3 pt-2 pb-2">
            {segments.map((segment, index) => (
                // Work groups draw their own card surface (header above,
                // rows on the card) via the 'card' activity appearance.
                <AgentTurnSegment
                    activityAppearance="card"
                    chatId={chatId}
                    defaultOpenWorkGroups
                    key={segment.key}
                    segment={segment}
                    turnActive={turnActive && index === segments.length - 1}
                    turnCompletedAt={null}
                    turnStartedAt={turnStartedAt}
                    turnStopped={false}
                />
            ))}
            {showPromptEvidence ? <TurnPromptEvidence runId={runId} /> : null}
        </div>
    );
}

// Live turns carry their evidence in the entry itself (the status stack
// builds it from streamed run evidence); completed turns fetch the durable
// execution record on demand.
function useTurnEvidenceItems(input: {
    chatId: string | null;
    responseId: string | null;
    turnActive: boolean;
}): TranscriptItem[] {
    const evidenceQuery = trpc.chat.turn.evidence.useQuery(
        { chatId: input.chatId ?? '', responseId: input.responseId ?? '' },
        { enabled: Boolean(input.chatId && input.responseId && !input.turnActive) }
    );
    const rows = input.turnActive ? [] : (evidenceQuery.data?.rows ?? []);

    return rows.map((row) => ({ kind: 'row' as const, row }));
}

// Evidence rows and the entry's own conversation items (reply, widgets) can
// overlap; the entry's copy wins so the pane and drawer agree, and the merged
// set reads in execution order.
function mergeTurnItems(evidenceItems: TranscriptItem[], entryItems: readonly TranscriptItem[]) {
    const entryIds = new Set(
        entryItems.flatMap((item) => (item.kind === 'row' ? [item.row.id] : []))
    );
    const merged = [
        ...evidenceItems.filter((item) => item.kind !== 'row' || !entryIds.has(item.row.id)),
        ...entryItems,
    ];

    return merged.sort((left, right) => {
        const leftTime = Date.parse(getItemTimestamp(left) ?? '');
        const rightTime = Date.parse(getItemTimestamp(right) ?? '');

        return (
            (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime) -
            (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime)
        );
    });
}

// The composed instructions and per-turn prompt are dev-mode-only runtime
// evidence (specs/chat-timeline.md); the turn's Wiki recall is gone with
// the Wiki retirement.
function TurnPromptEvidence({ runId }: { runId: string | null }) {
    const { devMode } = useDevMode();
    const evidence = useChatTurnPrompt(runId);

    if (!(evidence.data && devMode)) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <section className="grid gap-1.5">
                <h4 className="font-medium text-muted text-sm">Prompt (dev mode)</h4>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-surface-secondary px-3 py-2 font-mono text-code text-muted">
                    {`${evidence.data.instructions}\n\n--- turn prompt ---\n\n${evidence.data.prompt}`}
                </pre>
            </section>
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
