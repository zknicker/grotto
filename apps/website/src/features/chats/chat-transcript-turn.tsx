import { Chip, Separator } from '@heroui/react';
import { ChatMessage, ChatMessageActions } from '@heroui-pro/react';
import { Activity01Icon, AlertCircleIcon } from '@hugeicons-pro/core-stroke-rounded';
import { splitVisualFences } from '@tavern/api/widgets/visual';
import { useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { requestChatComposerMention } from '../../commands/chat-composer-mention.ts';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { openAgentProfilePane } from '../../hooks/pane/use-agent-profile-pane.ts';
import { writeClipboardText } from '../../lib/clipboard.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { AgentAvatar } from '../members/agent-avatar.tsx';
import { ActionTooltip } from './chat-action-tooltip.tsx';
import { ChatMarkdownText } from './chat-markdown-text.tsx';
import { useStreamingTextRanges } from './chat-streaming-text-ranges.ts';
import {
    ChatTranscriptActivity,
    ChatTranscriptActivityGroup,
} from './chat-transcript-activity.tsx';
import {
    getAssistantNarrationText,
    isAssistantNarrationItem,
} from './chat-transcript-activity-utils.ts';
import {
    type AgentItemSegment,
    getTranscriptItemKey,
    groupAgentItems,
} from './chat-transcript-item-utils.ts';
import {
    ChatTranscriptMessageContent,
    getTranscriptMessageContent,
    renderTranscriptMessageAttachments,
    type TranscriptMessage,
} from './chat-transcript-message.tsx';
import { TranscriptMessageBlock } from './chat-transcript-message-block.tsx';
import type {
    ConversationMessageLayout,
    TranscriptEntry,
    TranscriptItem,
    TranscriptRow,
} from './chat-transcript-model.ts';
import {
    getItemRunId,
    getItemSessionKey,
    isActivityBackedMessageRow,
    isStreamingPostMessageRow,
} from './chat-transcript-model.ts';
import {
    useTranscriptRenderContext,
    useTranscriptRenderContextOptional,
} from './chat-transcript-render-context.tsx';
import type { SessionNoticeRow } from './chat-transcript-row-model.ts';
import { RuntimeNoticeEntry, SessionNoticeAction } from './chat-transcript-system-step.tsx';
import { transcriptTurnGeometry } from './chat-transcript-turn-geometry.ts';
import { AgentWidget } from './legacy-widget-row.tsx';
import { isLocalTimelineMessageMetadata } from './local-timeline-message.ts';
import { ServerTurnDetailsDrawer } from './server-turn-details-drawer.tsx';
import { MessageReactionActions } from './thread/message-reactions.tsx';
import { ThreadMessageActions, ThreadMessageSurface } from './thread/thread-message-surface.tsx';
import type { TranscriptActiveReply, TranscriptActorProfile } from './transcript-contract.ts';
import { useRevealedText } from './use-revealed-text.ts';
import { VisualCard } from './visual-card.tsx';
import { WorkspaceChangesChip } from './workspace-changes-chip.tsx';

// Raft-style geometry: the name line plus the first message line read as one
// tight block the avatar sits centered against. Rows wash on hover so the
// hovered message reads as one unit (Discord-style); the bleed margins let
// the wash span the full chat width past the viewport's px-5 gutter. The
// wash also holds while a bar-owned popover (the emoji picker) is open, so
// moving the pointer into the portaled popover doesn't unwash the row.
const turnInteractionClassName =
    'group/turn hover:bg-background-hover has-[[data-turn-actions]_[aria-expanded=true]]:bg-background-hover';
// Stock action buttons are composer-sized; transcript rows want the compact
// footprint with slightly smaller glyphs.
const turnActionClassName = 'size-7 [&_svg]:size-4';
// The actions bar is a floating pill straddling the hovered message's top
// edge (Discord-style): elevated surface, instant reveal so it tracks the
// row wash, and inert while hidden so it never intercepts clicks meant for
// the row above. It stays open only for keyboard focus (data-focus-visible)
// and while its emoji picker popover is open (aria-expanded) — plain focus
// left behind by a click must not hold it, or the bar sticks after the
// pointer leaves.
const turnActionsClassName = cn(
    // Deliberately quiet: a bright overlay bg or a drop shadow pops far too
    // loud in light mode, and surface-secondary reads too grey there — the
    // background token splits the difference. Dark keeps surface-secondary
    // (its background token is near-black and would read as a hole). The
    // border alone defines the edge.
    'pointer-events-none absolute -top-4 right-5 z-10 items-center gap-px rounded-full border border-border bg-background p-0.5 opacity-0 transition-none dark:bg-surface-secondary',
    'group-hover/turn:pointer-events-auto group-hover/turn:opacity-100',
    'has-[[data-focus-visible]]:pointer-events-auto has-[[data-focus-visible]]:opacity-100',
    'has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100'
);

export function TranscriptEntryView({
    activeReply,
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    entry,
    followsRuntimeNotice,
    sessionNotice = null,
    turnStartedAt,
}: {
    activeReply: TranscriptActiveReply | null;
    chatId?: string;
    conversationLayout: ConversationMessageLayout;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups?: boolean;
    entry: TranscriptEntry;
    followsRuntimeNotice?: boolean;
    sessionNotice?: SessionNoticeRow | null;
    turnStartedAt?: string | null;
}) {
    if (entry.kind === 'system') {
        if (entry.item.kind === 'row' && entry.item.row.kind === 'message') {
            return (
                <ThreadMessageSurface row={entry.item.row}>
                    {/* pl-11.5 + the surface's px-5 = avatar + gap: the message text column. */}
                    <p className="flex items-baseline gap-2 py-2 pr-5 pl-11.5 text-muted text-sm">
                        <span className="min-w-0 truncate" title={entry.item.row.message.content}>
                            {entry.item.row.message.content}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0 text-xs">
                            <RelativeTime value={entry.item.row.message.timestamp} />
                        </span>
                    </p>
                </ThreadMessageSurface>
            );
        }
        if (
            entry.item.kind === 'row' &&
            entry.item.row.kind === 'system' &&
            entry.item.row.systemKind === 'runtimeNotice'
        ) {
            return <RuntimeNoticeEntry row={entry.item.row} />;
        }

        return (
            <div className="mt-4 w-full px-3 py-2.5">
                <ChatTranscriptActivity
                    chatId={chatId}
                    currentSessionKey={currentSessionKey}
                    item={entry.item}
                />
            </div>
        );
    }

    if (entry.participant === 'user') {
        return <UserTurn entry={entry} layout={conversationLayout} />;
    }

    return (
        <AgentTurn
            activeReply={activeReply}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            entry={entry}
            followsRuntimeNotice={Boolean(followsRuntimeNotice)}
            layout={conversationLayout}
            sessionNotice={sessionNotice}
            turnStartedAt={turnStartedAt}
        />
    );
}

function UserTurn({
    entry,
    layout,
}: {
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const context = useTranscriptRenderContext();

    return (
        <UserTurnPresentation
            actorProfile={context.resolveActorProfile?.(entry.actor) ?? null}
            entry={entry}
            layout={layout}
        />
    );
}

function UserTurnPresentation({
    actorProfile,
    entry,
    layout,
}: {
    actorProfile: TranscriptActorProfile | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const context = useTranscriptRenderContextOptional();
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'You';
    const hasPendingMessage = entry.items.some(
        (item) =>
            item.kind === 'row' &&
            item.row.kind === 'message' &&
            isLocalTimelineMessageMetadata(item.row.message.metadata)
    );
    const lastMessageRow = hasPendingMessage ? null : getLastMessageRow(entry.items);

    // Every human turn — the app owner's included — shares the same
    // left-aligned Slack-style roster row as agents: avatar, name header,
    // plain text. No right-anchored self bubbles.
    return (
        <ChatMessage.Assistant
            className={cn(transcriptTurnGeometry.row, lastMessageRow && turnInteractionClassName)}
        >
            <TurnAvatar
                avatarUrl={actorProfile?.avatarUrl}
                deleted={actorProfile?.deleted}
                name={displayName}
            />
            <ChatMessage.Body className={transcriptTurnGeometry.body}>
                {layout.showHumanIdentity ? (
                    <TurnHeader
                        deleted={actorProfile?.deleted}
                        displayName={displayName}
                        onClick={
                            entry.actor && context?.onActorClick && !actorProfile?.deleted
                                ? () => context.onActorClick?.(entry.actor)
                                : undefined
                        }
                        timestamp={entry.timestamp}
                    />
                ) : null}
                {entry.items.map((item) => (
                    <UserTurnItem from="user" item={item} key={getTranscriptItemKey(item)} />
                ))}
                {lastMessageRow ? (
                    <ChatMessageActions className={turnActionsClassName} data-turn-actions="">
                        <MessageReactionActions
                            className={turnActionClassName}
                            row={lastMessageRow}
                        />
                        {context?.onToggleReaction ? (
                            <Separator className="h-4 self-center" orientation="vertical" />
                        ) : null}
                        <TranscriptMessageActions value={lastMessageRow.message.content} />
                        <ThreadMessageActions
                            className={turnActionClassName}
                            row={lastMessageRow}
                        />
                    </ChatMessageActions>
                ) : null}
            </ChatMessage.Body>
        </ChatMessage.Assistant>
    );
}

function getActiveReplyText(items: TranscriptItem[]) {
    for (const item of items) {
        if (item.kind === 'activeReply') {
            return item.reply.text ?? '';
        }
    }

    return '';
}

/**
 * Agents and people share one identity mark: the uploaded square image when
 * there is one, initials otherwise.
 *
 * EntityAvatar rather than `ChatMessage.Avatar`, which takes no size and
 * hardcodes HeroUI's `md` preset. `md` rounds at `--radius * 3` while `sm` —
 * what the live-Agent path renders at 32px — rounds at `* 2`, so the two sat
 * side by side in the same column with visibly different corners at any
 * radius. One component and one preset is what actually keeps them identical.
 */
function TurnAvatar({
    avatarUrl,
    deleted = false,
    name,
}: {
    avatarUrl?: string | null;
    deleted?: boolean;
    name: string;
}) {
    return (
        <EntityAvatar
            className={cn(transcriptTurnGeometry.avatar, deleted && 'opacity-50 grayscale')}
            name={name}
            size={32}
            src={avatarUrl}
        />
    );
}

function AgentTurnAvatar({
    profile,
    name,
}: {
    profile: TranscriptActorProfile | null;
    name: string;
}) {
    if (profile?.availability.kind === 'live') {
        return (
            <AgentAvatar
                agent={{
                    availability: profile.availability.value,
                    avatarUrl: profile.avatarUrl,
                    displayName: name,
                    id: profile.id,
                }}
                className={transcriptTurnGeometry.avatar}
                size={32}
            />
        );
    }

    return <TurnAvatar avatarUrl={profile?.avatarUrl} deleted={profile?.deleted} name={name} />;
}

// Bios stay one quiet line: hard-capped well past any reasonable blurb, then
// CSS-truncated to whatever width the row actually has.
const turnHeaderBioMaxChars = 165;

function TurnHeader({
    bio,
    composerId,
    deleted = false,
    displayName,
    mentionAgentId,
    onClick,
    timestamp,
}: {
    bio?: string | null;
    composerId?: string;
    deleted?: boolean;
    displayName: string;
    mentionAgentId?: string;
    onClick?: () => void;
    timestamp: string | null;
}) {
    return (
        <div className={transcriptTurnGeometry.header}>
            {mentionAgentId && composerId ? (
                <button
                    aria-label={`Mention ${displayName}`}
                    className={cn(
                        transcriptTurnGeometry.name,
                        'cursor-(--cursor-interactive) hover:underline',
                        deleted ? 'text-muted' : 'text-foreground'
                    )}
                    onClick={() =>
                        requestChatComposerMention({ agentId: mentionAgentId, composerId })
                    }
                    type="button"
                >
                    {displayName}
                </button>
            ) : onClick ? (
                <button
                    className={cn(
                        transcriptTurnGeometry.name,
                        'cursor-(--cursor-interactive) hover:underline',
                        deleted ? 'text-muted' : 'text-foreground'
                    )}
                    onClick={onClick}
                    type="button"
                >
                    {displayName}
                </button>
            ) : (
                <span
                    className={cn(
                        transcriptTurnGeometry.name,
                        deleted ? 'text-muted' : 'text-foreground'
                    )}
                >
                    {displayName}
                </span>
            )}
            {deleted ? (
                <Chip size="sm" variant="secondary">
                    DELETED
                </Chip>
            ) : null}
            {bio ? (
                <span className="min-w-0 truncate text-muted text-xs leading-5">
                    {bio.length > turnHeaderBioMaxChars
                        ? `${bio.slice(0, turnHeaderBioMaxChars).trimEnd()}…`
                        : bio}
                </span>
            ) : null}
            {timestamp ? (
                <time className="shrink-0 text-muted text-xs tabular-nums" dateTime={timestamp}>
                    {formatShortTime(timestamp)}
                </time>
            ) : null}
        </div>
    );
}

export function resolveMentionAgentId(
    actorId: null | string,
    actorKind: 'agent' | 'participant' | 'profile' | undefined,
    canRequestMention: boolean
) {
    return canRequestMention && actorKind === 'agent' ? (actorId ?? undefined) : undefined;
}

function AgentTurn({
    activeReply,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    sessionNotice,
    turnStartedAt,
}: AgentTurnProps) {
    const context = useTranscriptRenderContext();

    return (
        <AgentTurnPresentation
            activeReply={activeReply}
            actorProfile={context.resolveActorProfile?.(entry.actor) ?? null}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            defaultOpenWorkGroups={defaultOpenWorkGroups}
            entry={entry}
            followsRuntimeNotice={followsRuntimeNotice}
            layout={layout}
            sessionNotice={sessionNotice}
            turnStartedAt={turnStartedAt}
        />
    );
}

interface AgentTurnProps {
    activeReply: TranscriptActiveReply | null;
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    sessionNotice?: SessionNoticeRow | null;
    turnStartedAt?: string | null;
}

function AgentTurnPresentation({
    activeReply,
    actorProfile,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    sessionNotice,
    turnStartedAt,
}: AgentTurnProps & { actorProfile: TranscriptActorProfile | null }) {
    const actorId = entry.actor?.id ?? null;
    const items = entry.items;
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const showIdentity = layout.showAgentIdentity;
    const lastMessageRow = getLastMessageRow(items);
    const lastMessage = lastMessageRow?.message ?? null;
    const turnCompletedAt = lastMessage?.timestamp ?? null;
    const {
        canRequestMention,
        composerId,
        turnDetails,
        onToggleReaction,
        profilePaneChatId,
        repliedRunIds,
    } = useTranscriptRenderContext();
    const segments = groupAgentItems(items);
    const visibleSegments = filterPaneSegments(segments, repliedRunIds);
    const turnStopped =
        hasStoppedTurn(items, activeReply?.runId) || (!activeReply && hasAnyStoppedTurn(items));
    const turnActive = isActiveTurn(items, activeReply, lastMessage);
    const turnRunId = items.map(getItemRunId).find((value) => value !== null) ?? null;
    const copyValue = lastMessage?.content ?? getActiveReplyText(items);
    const [inspectOpen, setInspectOpen] = React.useState(false);
    const [inspectMounted, setInspectMounted] = React.useState(false);
    const turnActions = (
        <>
            {lastMessageRow ? (
                <MessageReactionActions className={turnActionClassName} row={lastMessageRow} />
            ) : null}
            {lastMessageRow && onToggleReaction ? (
                <Separator className="h-4 self-center" orientation="vertical" />
            ) : null}
            {lastMessage ? (
                <TranscriptMessageActions value={lastMessage.content} />
            ) : copyValue ? (
                <TranscriptMessageActions disabled value={copyValue} />
            ) : null}
            {lastMessageRow ? (
                <ThreadMessageActions className={turnActionClassName} row={lastMessageRow} />
            ) : null}
            <ActionTooltip label="View turn details">
                <ChatMessage.Action
                    aria-label="View turn details"
                    className={turnActionClassName}
                    onPress={() => {
                        setInspectMounted(true);
                        setInspectOpen(true);
                    }}
                >
                    <Icon icon={Activity01Icon} strokeWidth={2} />
                </ChatMessage.Action>
            </ActionTooltip>
            {sessionNotice ? <SessionNoticeAction row={sessionNotice} /> : null}
        </>
    );

    // A lifecycle note with nothing above it is noise: a stopped turn that
    // never produced visible content drops out of the transcript entirely.
    // When the turn did produce content, the note stays as its footnote.
    if (
        visibleSegments.length === 0 ||
        visibleSegments.every(
            (segment) => segment.kind === 'item' && isTurnStatusItem(segment.item)
        )
    ) {
        return null;
    }

    return (
        <ChatMessage.Assistant
            className={cn(
                transcriptTurnGeometry.row,
                turnInteractionClassName,
                !showIdentity && followsRuntimeNotice && 'mt-0'
            )}
        >
            {chatId && actorId && profilePaneChatId && !actorProfile?.deleted ? (
                <button
                    aria-label={`Agent details: ${displayName}`}
                    className="shrink-0 cursor-(--cursor-interactive) self-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    onClick={() => openAgentProfilePane(profilePaneChatId, actorId)}
                    type="button"
                >
                    <AgentTurnAvatar name={displayName} profile={actorProfile} />
                </button>
            ) : (
                <AgentTurnAvatar name={displayName} profile={actorProfile} />
            )}
            <ChatMessage.Body className={transcriptTurnGeometry.body}>
                {showIdentity ? (
                    <TurnHeader
                        bio={actorProfile?.bio}
                        composerId={composerId}
                        deleted={actorProfile?.deleted}
                        displayName={displayName}
                        mentionAgentId={resolveMentionAgentId(
                            actorId,
                            actorProfile?.kind,
                            canRequestMention && Boolean(composerId) && !actorProfile?.deleted
                        )}
                        timestamp={entry.timestamp}
                    />
                ) : null}
                {visibleSegments.map((segment, index) => (
                    <AgentTurnSegment
                        chatId={chatId}
                        currentSessionKey={currentSessionKey}
                        defaultOpenWorkGroups={defaultOpenWorkGroups}
                        key={segment.key}
                        revealNarration={turnActive}
                        segment={segment}
                        turnActive={turnActive && index === visibleSegments.length - 1}
                        turnCompletedAt={turnCompletedAt}
                        turnStartedAt={turnStartedAt}
                        turnStopped={turnStopped}
                    />
                ))}
                <ChatMessageActions className={turnActionsClassName} data-turn-actions="">
                    {turnActions}
                </ChatMessageActions>
            </ChatMessage.Body>
            {/* Mounted on first use so long transcripts don't pay a drawer per turn. */}
            {inspectMounted && turnDetails ? (
                <ServerTurnDetailsDrawer
                    access={turnDetails.access}
                    agentAvatarUrl={actorProfile?.avatarUrl ?? null}
                    agentId={actorId}
                    agentName={displayName}
                    onOpenChange={setInspectOpen}
                    open={inspectOpen}
                    runId={turnRunId}
                    serverId={turnDetails.serverId}
                />
            ) : null}
        </ChatMessage.Assistant>
    );
}

// Exported for the turn drawer, which renders a turn's full segment list —
// activity groups included — outside the transcript pane.
export function AgentTurnSegment({
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    revealNarration = false,
    segment,
    turnActive,
    turnCompletedAt,
    turnStopped,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    revealNarration?: boolean;
    segment: AgentItemSegment;
    turnActive: boolean;
    turnCompletedAt: string | null;
    turnStopped: boolean;
    turnStartedAt?: string | null;
}) {
    if (segment.kind === 'activity') {
        return (
            <ChatTranscriptActivityGroup
                chatId={chatId}
                currentSessionKey={currentSessionKey}
                defaultOpen={defaultOpenWorkGroups}
                items={segment.items}
                showDurationHeader={false}
                turnActive={turnActive}
                turnCompletedAt={turnCompletedAt}
                turnStartedAt={turnStartedAt}
                turnStopped={turnStopped}
            />
        );
    }

    return (
        <AgentTurnItem
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            item={segment.item}
            revealNarration={revealNarration}
        />
    );
}

function isActiveStatusSegment(segment: AgentItemSegment) {
    return segment.kind === 'item' && segment.item.kind === 'activeStatus';
}

// The chat pane shows only the turn's latest narration and the final
// response. Narration (preamble and intra-turn updates) renders through one
// replace-in-place slot while the turn runs and drops once the run's final
// reply arrives; the full narration history stays in the turn drawer.
// Tool, thinking, and other work activity lives in the turn drawer too —
// except clarifications, which are conversational and must stay visible.
// Exported for tests only.
export function filterPaneSegments(
    segments: AgentItemSegment[],
    repliedRunIds: ReadonlySet<string> = new Set()
): AgentItemSegment[] {
    // A run's reply usually sits in this entry, but turn splits (interleaved
    // rows, runtime notices) can land it in a sibling entry — the transcript
    // provides those runs via repliedRunIds.
    const entryRepliedRunIds = new Set(
        segments.flatMap((segment) =>
            segment.kind === 'item' && isFinalReplyItem(segment.item)
                ? [getItemRunId(segment.item)]
                : []
        )
    );
    const lastNarrationKeyByRun = new Map<string | null, string>();

    for (const segment of segments) {
        if (segment.kind === 'item' && isNarrationItem(segment.item)) {
            lastNarrationKeyByRun.set(getItemRunId(segment.item), segment.key);
        }
    }

    return segments.flatMap((segment): AgentItemSegment[] => {
        if (segment.kind !== 'activity') {
            if (isActiveStatusSegment(segment)) {
                return [];
            }

            if (segment.kind === 'item' && isNarrationItem(segment.item)) {
                const runId = getItemRunId(segment.item);

                if (
                    entryRepliedRunIds.has(runId) ||
                    (runId !== null && repliedRunIds.has(runId)) ||
                    lastNarrationKeyByRun.get(runId) !== segment.key
                ) {
                    return [];
                }

                // One stable key per run: successive narration updates render
                // through the same slot, so each replaces the previous one in
                // place instead of appending a new row.
                return [{ ...segment, key: `narration:${runId ?? segment.key}` }];
            }

            return [segment];
        }

        const clarifications = segment.items.filter(isClarificationItem);
        // Changed-files chips are contribution outcome and render standalone
        // (item segments), never inside a collapsed work group.
        const fileChangeSegments = segment.items
            .filter(isWorkspaceChangesItem)
            .map((item, index): AgentItemSegment => {
                const key =
                    item.kind === 'row' ? item.row.id : `${segment.key}:files:${String(index)}`;
                return { item, key, kind: 'item' };
            });

        return [
            ...(clarifications.length > 0
                ? [{ ...segment, items: clarifications, key: `${segment.key}:clarify` }]
                : []),
            ...fileChangeSegments,
        ];
    });
}

function isStreamingPostRow(row: Extract<TranscriptItem, { kind: 'row' }>['row']) {
    return (
        row.kind === 'message' &&
        row.message.senderType === 'agent' &&
        isStreamingPostMessageRow(row)
    );
}

function isNarrationItem(item: TranscriptItem) {
    return (
        isAssistantNarrationItem(item) ||
        (item.kind === 'row' &&
            item.row.kind === 'message' &&
            item.row.message.senderType === 'agent' &&
            isActivityBackedMessageRow(item.row))
    );
}

function isFinalReplyItem(item: TranscriptItem) {
    if (item.kind === 'activeReply') {
        return true;
    }

    return (
        item.kind === 'row' &&
        item.row.kind === 'message' &&
        item.row.message.senderType === 'agent' &&
        !isActivityBackedMessageRow(item.row)
    );
}

function isClarificationItem(item: TranscriptItem) {
    return item.kind === 'row' && item.row.kind === 'tool' && Boolean(item.row.clarification);
}

function isWorkspaceChangesItem(item: TranscriptItem) {
    return (
        item.kind === 'row' &&
        item.row.kind === 'tool' &&
        item.row.toolCall.name === 'workspace_changes'
    );
}

function UserTurnItem({ from, item }: { from: 'assistant' | 'user'; item: TranscriptItem }) {
    const animateLiveEnter = useLiveEdgeMessageEnter(item);
    const context = useTranscriptRenderContextOptional();

    if (item.kind !== 'row' || item.row.kind !== 'message') {
        return null;
    }

    const message = item.row.message;
    const pending = isLocalTimelineMessageMetadata(message.metadata);
    const attachments = context?.renderMessageAttachments
        ? context.renderMessageAttachments(message)
        : renderTranscriptMessageAttachments(message.attachments);
    const body = context?.renderMessageContent ? (
        context.renderMessageContent(message)
    ) : (
        <ChatTranscriptMessageContent message={message} textClassName="text-current" />
    );

    if (!body) {
        return null;
    }

    const block = (
        <TranscriptMessageBlock
            {...(pending ? { animate: { opacity: 0.7, scale: 1, y: 0 } } : {})}
            animateEnter={pending || animateLiveEnter}
            attachments={attachments}
            data-slot={pending ? 'pending-chat-message' : undefined}
            from={from}
        >
            {body}
        </TranscriptMessageBlock>
    );

    return pending ? block : <ThreadMessageSurface row={item.row}>{block}</ThreadMessageSurface>;
}

// Whether this item is a message landing at the transcript's live edge right
// now; such messages animate in instead of popping. Always false outside the
// transcript (the turn drawer).
function useLiveEdgeMessageEnter(item: TranscriptItem) {
    const context = useTranscriptRenderContextOptional();

    if (!(context && item.kind === 'row' && item.row.kind === 'message')) {
        return false;
    }

    const timestampMs = Date.parse(item.row.message.timestamp);

    return context.shouldAnimateItemEnter(
        getTranscriptItemKey(item),
        Number.isNaN(timestampMs) ? null : timestampMs
    );
}

function AgentTurnItem({
    chatId,
    currentSessionKey,
    item,
    revealNarration = false,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    item: TranscriptItem;
    revealNarration?: boolean;
}) {
    const animateLiveEnter = useLiveEdgeMessageEnter(item);

    if (item.kind === 'activeReply') {
        return (
            <AssistantReplyBody
                content={getActiveReplyDisplayText(item.reply.text ?? '')}
                revealKey={item.reply.runId}
                revealText={isStreamingActiveReply(item.reply)}
                slotKey={item.reply.runId}
            />
        );
    }

    if (item.kind === 'activeStatus') {
        return null;
    }

    if (isAssistantNarrationItem(item)) {
        return <AssistantNarrationText item={item} />;
    }

    if (item.kind === 'row' && item.row.kind === 'message') {
        // A streaming post is the turn's contribution mid-edit: reveal its
        // text like a live reply and keep partial widget fences hidden.
        const streaming = revealNarration && isStreamingPostRow(item.row);

        if (streaming) {
            // A streaming post is not durable yet (a silent turn discards
            // it), so it offers no thread affordances.
            return (
                <AssistantReplyBody
                    animateEnter
                    content={getActiveReplyDisplayText(item.row.message.content)}
                    revealKey={item.row.id}
                    revealText
                    slotKey={getItemRunId(item) ?? item.row.id}
                />
            );
        }

        const narration = revealNarration && isActivityBackedMessageRow(item.row);

        return (
            <ThreadMessageSurface row={item.row}>
                <AssistantReplyBody
                    message={item.row.message}
                    {...(narration
                        ? {
                              animateEnter: true,
                              revealKey: item.row.id,
                              revealText: true,
                              slotKey: getItemRunId(item) ?? item.row.id,
                          }
                        : // A finished reply that never streamed here (fast turn,
                          // another device's turn) still lands at the live edge —
                          // it enters like any new message instead of popping.
                          { animateEnter: animateLiveEnter })}
                />
            </ThreadMessageSurface>
        );
    }

    if (item.kind === 'row' && item.row.kind === 'widget') {
        return <AgentWidget row={item.row} />;
    }

    if (item.kind === 'row' && item.row.kind === 'tool' && isWorkspaceChangesItem(item)) {
        return <WorkspaceChangesChip chatId={chatId} row={item.row} />;
    }

    if (isTurnStatusItem(item)) {
        return <AgentTurnStatus item={item} />;
    }

    return (
        <ChatTranscriptActivity chatId={chatId} currentSessionKey={currentSessionKey} item={item} />
    );
}

function AssistantNarrationText({ item }: { item: TranscriptItem }) {
    const text = getAssistantNarrationText(item);

    return text ? (
        <div className="min-w-0 max-w-[46rem] whitespace-pre-wrap break-words text-base text-foreground leading-6 [overflow-wrap:anywhere]">
            {text}
        </div>
    ) : null;
}

function AssistantReplyText({
    animateEnter = false,
    content,
    message,
    revealKey,
    revealText = false,
    slotKey = null,
}: {
    animateEnter?: boolean;
    content?: string;
    message?: TranscriptMessage;
    revealKey?: string;
    revealText?: boolean;
    slotKey?: string | null;
}) {
    const fullContent = content ?? (message ? getTranscriptMessageContent(message) : '');
    const messagePhase = message ? getAssistantMessagePhase(message) : null;
    const isCommentary = messagePhase === 'commentary';
    const revealedText = useRevealedText(fullContent, {
        enabled: revealText,
        revealKey: revealKey ?? (message ? getAssistantMessageRevealKey(message) : 'assistant'),
    });
    const shouldReduceMotion = useReducedMotion();
    const context = useTranscriptRenderContextOptional();
    const animatedRanges = useStreamingTextRanges(revealedText, {
        enabled:
            shouldReduceMotion !== true && (revealText || revealedText.length < fullContent.length),
    });
    const attachments = message
        ? context?.renderMessageAttachments
            ? context.renderMessageAttachments(message)
            : renderTranscriptMessageAttachments(message.attachments)
        : null;
    const ratchetRef = useRatchetedMinHeight(revealText, slotKey);
    const body = message ? (
        context?.renderMessageContent ? (
            context.renderMessageContent({ ...message, content: revealedText })
        ) : (
            <ChatTranscriptMessageContent
                animatedRanges={animatedRanges}
                contentOverride={revealedText}
                message={message}
                textClassName={isCommentary ? 'text-muted' : undefined}
            />
        )
    ) : (
        <ChatMarkdownText animatedRanges={animatedRanges} content={revealedText} />
    );

    return (
        <TranscriptMessageBlock
            animateEnter={animateEnter}
            attachments={attachments}
            className={isCommentary ? 'opacity-85' : undefined}
            data-message-phase={messagePhase ?? undefined}
            from="assistant"
        >
            {/* The reveal empties and regrows the text when a narration swap
                restarts it; the ratcheted floor keeps the slot from ever
                shrinking mid-turn so the bottom-anchored transcript holds
                still. The floor dies with the slot when the reply lands. */}
            {revealText ? (
                <div className="min-h-[1lh]" ref={ratchetRef}>
                    {body}
                </div>
            ) : (
                body
            )}
        </TranscriptMessageBlock>
    );
}

// Any assistant reply — streaming or durable — may carry ```visual fences:
// fence bodies render as visual cards below the prose, never as raw fence
// text. Message content is the single source of truth for visuals; there is
// no separate durable widget projection. An unclosed trailing fence is an
// in-progress visual whose body grows as content arrives.
function AssistantReplyBody(props: {
    animateEnter?: boolean;
    content?: string;
    message?: TranscriptMessage;
    revealKey?: string;
    revealText?: boolean;
    slotKey?: string | null;
}) {
    const fullContent =
        props.content ?? (props.message ? getTranscriptMessageContent(props.message) : '');
    const segments = splitVisualFences(fullContent);
    const slot = props.slotKey ?? props.revealKey ?? 'visual';
    // The Nth fence in the reply is that visual's stable identity: content
    // only appends while streaming, so ordinals never reorder.
    const cards: React.ReactNode[] = [];
    for (const segment of segments) {
        if (segment.kind === 'visual') {
            cards.push(
                <div className="max-w-[46rem]" key={`${slot}:visual:${cards.length + 1}`}>
                    <VisualCard html={segment.html} open={segment.open} title={segment.title} />
                </div>
            );
        }
    }

    if (cards.length === 0) {
        return <AssistantReplyText {...props} />;
    }

    const prose = segments
        .filter((segment) => segment.kind === 'text')
        .map((segment) => segment.text)
        .join('')
        .trim();

    // Keep the message shell when there is prose OR attachments — a durable
    // reply that is only a visual fence still carries its attached files, and
    // those render through the text body, not the cards.
    const hasAttachments = (props.message?.attachments?.length ?? 0) > 0;

    return (
        <>
            {prose || hasAttachments ? <AssistantReplyText {...props} content={prose} /> : null}
            {cards}
        </>
    );
}

// Tallest height each live narration slot has reached, keyed by run. Module
// level on purpose: narration swaps can remount the slot, and the floor must
// survive the remount or the swap still shrinks the turn. Entries are a few
// bytes per run; the map is cleared when it grows past a session's worth.
const narrationSlotHeights = new Map<string, number>();
const maxTrackedNarrationSlots = 64;

// Latches the tallest height the live narration slot has reached and holds it
// as min-height, so replace-in-place text swaps never shrink the turn while
// it is running. The floor dies with the slot when the reply replaces it.
function useRatchetedMinHeight(enabled: boolean, slotKey: string | null) {
    const ref = React.useRef<HTMLDivElement | null>(null);

    React.useLayoutEffect(() => {
        if (!(enabled && slotKey && ref.current)) {
            return;
        }

        const floor = narrationSlotHeights.get(slotKey) ?? 0;
        const height = Math.max(ref.current.offsetHeight, floor);

        if (height > floor) {
            if (narrationSlotHeights.size >= maxTrackedNarrationSlots) {
                narrationSlotHeights.clear();
            }

            narrationSlotHeights.set(slotKey, height);
        }

        ref.current.style.minHeight = `${height}px`;
    });

    return ref;
}

function getAssistantMessagePhase(message: TranscriptMessage) {
    const runtime = message.metadata?.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return null;
    }

    const phase = (runtime as Record<string, unknown>).messagePhase;
    return phase === 'commentary' || phase === 'final_answer' ? phase : null;
}

function getAssistantMessageRevealKey(message: TranscriptMessage) {
    const runtime = message.metadata?.runtime;

    if (!(runtime && typeof runtime === 'object' && !Array.isArray(runtime))) {
        return message.id;
    }

    const runId = (runtime as Record<string, unknown>).runId;

    return typeof runId === 'string' && runId.trim().length > 0 ? runId : message.id;
}

function isStreamingActiveReply(reply: TranscriptActiveReply) {
    return !reply.completedAt;
}

export function getActiveReplyDisplayText(text: string) {
    return text.trimStart().trimEnd();
}

function AgentTurnStatus({
    item,
}: {
    item: Extract<TranscriptItem, { kind: 'row' }> & {
        row: Extract<TranscriptRow, { kind: 'system'; systemKind: 'turnStatus' }>;
    };
}) {
    // A stopped turn is a quiet lifecycle note, not an error: the icon shares
    // the text's muted color so the row reads as a footnote under whatever
    // the turn already produced.
    return (
        <p className="max-w-[34rem] pl-0.5 text-muted text-sm leading-5">
            <Icon
                aria-hidden
                className="mr-1.5 inline-block size-3.5 shrink-0 align-[-0.2em]"
                icon={AlertCircleIcon}
                strokeWidth={2}
            />
            <span className="font-medium">{item.row.turnStatus.text}</span>
        </p>
    );
}

function isTurnStatusItem(item: TranscriptItem): item is Extract<
    TranscriptItem,
    { kind: 'row' }
> & {
    row: Extract<TranscriptRow, { kind: 'system'; systemKind: 'turnStatus' }>;
} {
    return (
        item.kind === 'row' && item.row.kind === 'system' && item.row.systemKind === 'turnStatus'
    );
}

function TranscriptMessageActions({
    disabled = false,
    value,
}: {
    disabled?: boolean;
    value: string;
}) {
    const label = disabled ? 'Copy available when complete' : 'Copy message';

    return (
        <ActionTooltip label={label}>
            <ChatMessageActions.Copy
                aria-label={label}
                className={turnActionClassName}
                isDisabled={disabled}
                onPress={() => void writeClipboardText(value)}
            />
        </ActionTooltip>
    );
}

function getLastMessageRow(items: TranscriptItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (
            item?.kind === 'row' &&
            item.row.kind === 'message' &&
            !isActivityBackedMessageRow(item.row)
        ) {
            return item.row;
        }
    }

    return null;
}

function getLastMessage(items: TranscriptItem[]) {
    return getLastMessageRow(items)?.message ?? null;
}

function isActiveTurn(
    items: TranscriptItem[],
    activeReply: TranscriptActiveReply | null,
    lastMessage: Extract<TranscriptRow, { kind: 'message' }>['message'] | null
) {
    if (!activeReply || activeReply.completedAt || hasStoppedTurn(items, activeReply.runId)) {
        return false;
    }

    // The turn's post exists from its first streamed content and edits in
    // place while the run is live; only a finalized last message means the
    // turn has landed its reply.
    if (lastMessage !== null && !isStreamingMessageMetadata(lastMessage.metadata)) {
        return false;
    }

    return items.some((item) => getItemSessionKey(item) === activeReply.sessionKey);
}

function isStreamingMessageMetadata(metadata: Record<string, unknown> | null | undefined) {
    const runtime = metadata?.runtime;

    return Boolean(
        runtime &&
            typeof runtime === 'object' &&
            !Array.isArray(runtime) &&
            (runtime as Record<string, unknown>).streaming === true
    );
}

function hasStoppedTurn(items: TranscriptItem[], runId: string | null | undefined) {
    return Boolean(
        runId &&
            items.some(
                (item) =>
                    item.kind === 'row' &&
                    item.row.kind === 'system' &&
                    item.row.systemKind === 'turnStatus' &&
                    item.row.turnStatus.runId === runId
            )
    );
}

function hasAnyStoppedTurn(items: TranscriptItem[]) {
    return items.some(
        (item) =>
            item.kind === 'row' &&
            item.row.kind === 'system' &&
            item.row.systemKind === 'turnStatus'
    );
}

function getTurnFallbackName(entry: Extract<TranscriptEntry, { kind: 'turn' }>) {
    const message = getLastMessage(entry.items);
    return message?.sender ?? null;
}
