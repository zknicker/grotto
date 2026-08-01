import { Avatar } from '@heroui/react';
import { AlertCircleIcon, ListViewIcon } from '@hugeicons/core-free-icons';
import type { AgentCharacter } from '@tavern/api/agent-appearance';
import { splitVisualFences } from '@tavern/api/widgets/visual';
import { useReducedMotion } from 'framer-motion';
import * as React from 'react';
import { requestChatComposerMention } from '../../commands/chat-composer-mention.ts';
import { ChatMessage } from '../../components/chats/chat-message.tsx';
import {
    Message,
    MessageAvatar,
    MessageContent,
    MessageHeader,
} from '../../components/chats/message.tsx';
import { CopyButton } from '../../components/copy-button.tsx';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { RelativeTime } from '../../components/time/relative-time.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { type ActorProfile, useActorProfile } from '../../hooks/actors/use-actor.ts';
import { isLocalTimelineMessageMetadata } from '../../hooks/chats/chat-timeline-messages.ts';
import type { ChatActiveReply } from '../../hooks/chats/chat-timeline-state.ts';
import { openAgentProfilePane } from '../../hooks/pane/use-agent-profile-pane.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { AgentWidget } from '../../widgets/render-widget.tsx';
import { VisualCard } from '../../widgets/visual.tsx';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace, type HeadName } from './agent-face.tsx';
import { AgentHoverCard } from './agent-hover-card.tsx';
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
import { ChatTurnDrawer } from './chat-turn-drawer.tsx';
import { ThreadMessageSurface } from './thread/thread-message-surface.tsx';
import { useRevealedText } from './use-revealed-text.ts';
import { WorkspaceChangesChip } from './workspace-changes-chip.tsx';

// `group/turn` is the hover unit for a whole message: hovering the row reveals
// its actions (the copy button next to the timestamp, or above the owner's own
// bubble). Spacing is intentionally tight — the row's own `py` padding carries
// most of the room between messages, with only a small gap between scroller
// items (see chat-transcript.tsx). gap-3 widens the avatar gutter past the
// Message default so the roster breathes.
const rowClassName = 'group/turn w-full gap-3 py-1';
// Message actions stay hidden until the row is hovered or focused. No
// transition — the affordance tracks the pointer instantly.
const hoverActionsClassName =
    'flex items-center gap-0.5 opacity-0 focus-within:opacity-100 group-hover/turn:opacity-100';
const newTurnGapClassName = '';
// Pin the identity avatar to the top of the row. The shadcn MessageAvatar
// defaults to self-end and lifts by -translate-y-8 when the message has a
// footer; our roster layout keeps it aligned with the name header instead.
// 40px avatar spans the header + first message line as one block (Raft
// proportions). mt-1.5 seats the top edge ~2px above the username's visible
// cap (the name's line box has ~3px of half-leading above the glyphs), so
// the avatar reads inline with the sender line rather than floating high.
const turnAvatarBaseClassName =
    'mt-1.5 size-10 min-w-10 self-start ring-1 ring-separator group-has-data-[slot=message-footer]/message:translate-y-0';
// Stock Avatar owns the human identity mark; this only positions it in the
// turn row.
const turnAvatarPositionClassName =
    'mt-1.5 shrink-0 self-start group-has-data-[slot=message-footer]/message:translate-y-0';
// The character head is the avatar: a square-ish little character at the
// same footprint and roundedness as the people avatars beside it.
const faceStyle = { flexShrink: 0, height: 40, overflow: 'visible', width: 40 } as const;
const hoverGroupClassName = 'group';

export function TranscriptEntryView({
    activeReply,
    agentStatusCharacter = null,
    chatId,
    conversationLayout,
    currentSessionKey,
    defaultOpenWorkGroups = false,
    entry,
    followsRuntimeNotice,
    sessionNotice = null,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusCharacter?: AgentCharacter | null;
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
                    <p className="flex justify-center gap-2 px-5 py-2 text-center text-meta text-muted">
                        <span>{entry.item.row.message.content}</span>
                        <span aria-hidden="true">·</span>
                        <RelativeTime value={entry.item.row.message.timestamp} />
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
            agentStatusCharacter={agentStatusCharacter}
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
    const context = useTranscriptRenderContextOptional();

    if (context?.resolveActorProfile) {
        return (
            <UserTurnPresentation
                actorProfile={context.resolveActorProfile(entry.actor)}
                entry={entry}
                layout={layout}
            />
        );
    }

    return <LocalUserTurn entry={entry} layout={layout} />;
}

function LocalUserTurn({
    entry,
    layout,
}: {
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const actorProfile = useActorProfile(entry.actor);

    return <UserTurnPresentation actorProfile={actorProfile} entry={entry} layout={layout} />;
}

function UserTurnPresentation({
    actorProfile,
    entry,
    layout,
}: {
    actorProfile: ActorProfile | null;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    layout: ConversationMessageLayout;
}) {
    const context = useTranscriptRenderContextOptional();
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'You';
    const lastMessage = getLastMessage(entry.items);

    // Every human turn — the app owner's included — shares the same
    // left-aligned Slack-style roster row as agents: avatar, name header,
    // plain text. No right-anchored self bubbles.
    return (
        <Message align="start" className={cn(rowClassName, newTurnGapClassName)}>
            <TurnAvatar
                actorKind={actorProfile?.kind ?? 'participant'}
                avatarUrl={actorProfile?.avatarUrl}
                color={actorProfile?.primaryColor}
                name={displayName}
            />
            <MessageContent className="gap-0 pt-0.5">
                {layout.showHumanIdentity ? (
                    <TurnHeader
                        actions={
                            lastMessage ? (
                                <TranscriptMessageActions value={lastMessage.content} />
                            ) : null
                        }
                        displayName={displayName}
                        onClick={
                            entry.actor && context?.onActorClick
                                ? () => context.onActorClick?.(entry.actor)
                                : undefined
                        }
                        timestamp={entry.timestamp}
                    />
                ) : null}
                <div className="-mt-0.5 flex min-w-0 flex-col gap-1.5">
                    {entry.items.map((item) => (
                        <UserTurnItem from="user" item={item} key={getTranscriptItemKey(item)} />
                    ))}
                </div>
            </MessageContent>
        </Message>
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

function TurnAvatar({
    actorKind,
    avatarUrl,
    character = 'none',
    color,
    name,
}: {
    actorKind: 'agent' | 'participant' | 'profile';
    avatarUrl?: string | null;
    character?: HeadName;
    color?: string | null;
    name: string;
}) {
    // Agents wear their character face as their identity avatar; people use an
    // uploaded image, falling back to initials.
    const dark = useResolvedThemeOptional() === 'dark';
    const variant = resolveTurnAvatarVariant(actorKind, avatarUrl);

    if (variant === 'eyes') {
        // The character head is its own avatar shape — no chrome behind it.
        return (
            <MessageAvatar
                className={cn(
                    turnAvatarBaseClassName,
                    'overflow-visible rounded-none bg-transparent ring-0'
                )}
            >
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={character}
                    ink={resolveAgentInk(dark, color)}
                    size={40}
                    style={faceStyle}
                />
            </MessageAvatar>
        );
    }

    // People are stock Avatars — image when uploaded, initials fallback —
    // the same mark as the server monogram and sidebar minis.
    return (
        <Avatar className={turnAvatarPositionClassName}>
            {variant === 'image' ? (
                <Avatar.Image alt={`${name} avatar`} src={avatarUrl ?? undefined} />
            ) : null}
            <Avatar.Fallback>{getActorInitials(name)}</Avatar.Fallback>
        </Avatar>
    );
}

// Bios stay one quiet line: hard-capped well past any reasonable blurb, then
// CSS-truncated to whatever width the row actually has.
const turnHeaderBioMaxChars = 165;

function TurnHeader({
    actions,
    bio,
    composerId,
    displayName,
    mentionAgentId,
    onClick,
    timestamp,
}: {
    actions?: React.ReactNode;
    bio?: string | null;
    composerId?: string;
    displayName: string;
    mentionAgentId?: string;
    onClick?: () => void;
    timestamp: string | null;
}) {
    return (
        <MessageHeader className="gap-2 px-0">
            {mentionAgentId && composerId ? (
                <button
                    aria-label={`Mention ${displayName}`}
                    className="shrink-0 cursor-pointer truncate font-semibold text-foreground text-sm leading-5 hover:underline"
                    onClick={() =>
                        requestChatComposerMention({ agentId: mentionAgentId, composerId })
                    }
                    type="button"
                >
                    {displayName}
                </button>
            ) : onClick ? (
                <button
                    className="shrink-0 cursor-pointer truncate font-semibold text-foreground text-sm leading-5 hover:underline"
                    onClick={onClick}
                    type="button"
                >
                    {displayName}
                </button>
            ) : (
                <span className="shrink-0 truncate font-semibold text-foreground text-sm leading-5">
                    {displayName}
                </span>
            )}
            {bio ? (
                <span className="min-w-0 truncate text-meta text-muted leading-5">
                    {bio.length > turnHeaderBioMaxChars
                        ? `${bio.slice(0, turnHeaderBioMaxChars).trimEnd()}…`
                        : bio}
                </span>
            ) : null}
            {timestamp ? (
                <time className="shrink-0 text-meta text-muted tabular-nums" dateTime={timestamp}>
                    {formatShortTime(timestamp)}
                </time>
            ) : null}
            {actions ? <span className={hoverActionsClassName}>{actions}</span> : null}
        </MessageHeader>
    );
}

export function resolveTurnAvatarVariant(
    actorKind: 'agent' | 'participant' | 'profile',
    avatarUrl?: string | null
): 'eyes' | 'image' | 'initials' {
    if (actorKind === 'agent') {
        return 'eyes';
    }

    return avatarUrl ? 'image' : 'initials';
}

export function resolveMentionAgentId(
    actorId: null | string,
    actorKind: 'agent' | 'participant' | 'profile' | undefined,
    canRequestMention: boolean
) {
    return canRequestMention && actorKind === 'agent' ? (actorId ?? undefined) : undefined;
}

function getActorInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return '?';
    }

    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
    }

    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function AgentTurn({
    activeReply,
    agentStatusCharacter,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    sessionNotice,
    turnStartedAt,
}: {
    activeReply: ChatActiveReply | null;
    agentStatusCharacter: AgentCharacter | null;
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    sessionNotice?: SessionNoticeRow | null;
    turnStartedAt?: string | null;
}) {
    const context = useTranscriptRenderContext();

    if (context.resolveActorProfile) {
        return (
            <AgentTurnPresentation
                activeReply={activeReply}
                actorProfile={context.resolveActorProfile(entry.actor)}
                agentStatusCharacter={agentStatusCharacter}
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

    return (
        <LocalAgentTurn
            activeReply={activeReply}
            agentStatusCharacter={agentStatusCharacter}
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
    activeReply: ChatActiveReply | null;
    agentStatusCharacter: AgentCharacter | null;
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpenWorkGroups: boolean;
    entry: Extract<TranscriptEntry, { kind: 'turn' }>;
    followsRuntimeNotice: boolean;
    layout: ConversationMessageLayout;
    sessionNotice?: SessionNoticeRow | null;
    turnStartedAt?: string | null;
}

function LocalAgentTurn(props: AgentTurnProps) {
    const actorProfile = useActorProfile(props.entry.actor);

    return <AgentTurnPresentation actorProfile={actorProfile} {...props} />;
}

function AgentTurnPresentation({
    activeReply,
    actorProfile,
    agentStatusCharacter,
    chatId,
    currentSessionKey,
    defaultOpenWorkGroups,
    entry,
    followsRuntimeNotice,
    layout,
    sessionNotice,
    turnStartedAt,
}: AgentTurnProps & { actorProfile: ActorProfile | null }) {
    const actorId = entry.actor?.id ?? null;
    const items = entry.items;
    const displayName = actorProfile?.name ?? getTurnFallbackName(entry) ?? 'Agent';
    const showIdentity = layout.showAgentIdentity;
    const lastMessage = getLastMessage(items);
    const turnCompletedAt = lastMessage?.timestamp ?? null;
    const {
        canRequestMention,
        composerId,
        disableAgentHoverCard,
        profilePaneChatId,
        repliedRunIds,
        turnEvidenceSource,
    } = useTranscriptRenderContext();
    const segments = groupAgentItems(items);
    const visibleSegments = filterPaneSegments(segments, repliedRunIds);
    const turnStopped =
        hasStoppedTurn(items, activeReply?.runId) || (!activeReply && hasAnyStoppedTurn(items));
    const turnActive = isActiveTurn(items, activeReply, lastMessage);
    const copyValue = lastMessage?.content ?? getActiveReplyText(items);
    const [inspectOpen, setInspectOpen] = React.useState(false);
    const [inspectMounted, setInspectMounted] = React.useState(false);
    const headerActions = (
        <>
            {lastMessage ? (
                <TranscriptMessageActions value={lastMessage.content} />
            ) : copyValue ? (
                <TranscriptMessageActions disabled value={copyValue} />
            ) : null}
            <button
                aria-label="View turn details"
                className={messageActionButtonClassName}
                onClick={() => {
                    setInspectMounted(true);
                    setInspectOpen(true);
                }}
                title="View turn details"
                type="button"
            >
                <Icon className="size-3.5" icon={ListViewIcon} strokeWidth={2} />
            </button>
            {sessionNotice ? (
                <SessionNoticeAction className={messageActionButtonClassName} row={sessionNotice} />
            ) : null}
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
        <Message
            align="start"
            className={cn(
                rowClassName,
                showIdentity ? newTurnGapClassName : followsRuntimeNotice ? 'mt-0' : null
            )}
        >
            {chatId && actorId && !disableAgentHoverCard ? (
                <AgentHoverCard
                    agentId={actorId}
                    agentName={displayName}
                    chatId={chatId}
                    onOpenProfile={
                        profilePaneChatId
                            ? () => openAgentProfilePane(profilePaneChatId, actorId)
                            : undefined
                    }
                    triggerButtonClassName="cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    // self-start keeps the trigger from stretching to the row
                    // height and re-centering the avatar it wraps.
                    triggerClassName="shrink-0 self-start"
                >
                    <TurnAvatar
                        actorKind="agent"
                        character={actorProfile?.character ?? agentStatusCharacter ?? 'none'}
                        color={actorProfile?.primaryColor}
                        name={displayName}
                    />
                </AgentHoverCard>
            ) : chatId && actorId && profilePaneChatId ? (
                <button
                    aria-label={`Agent details: ${displayName}`}
                    className="shrink-0 cursor-pointer self-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openAgentProfilePane(profilePaneChatId, actorId)}
                    type="button"
                >
                    <TurnAvatar
                        actorKind="agent"
                        character={actorProfile?.character ?? agentStatusCharacter ?? 'none'}
                        color={actorProfile?.primaryColor}
                        name={displayName}
                    />
                </button>
            ) : (
                <TurnAvatar
                    actorKind="agent"
                    character={actorProfile?.character ?? agentStatusCharacter ?? 'none'}
                    color={actorProfile?.primaryColor}
                    name={displayName}
                />
            )}
            <MessageContent className="gap-0 pt-0.5">
                {showIdentity ? (
                    <TurnHeader
                        actions={headerActions}
                        bio={actorProfile?.bio}
                        composerId={composerId}
                        displayName={displayName}
                        mentionAgentId={resolveMentionAgentId(
                            actorId,
                            actorProfile?.kind,
                            canRequestMention && Boolean(composerId)
                        )}
                        timestamp={entry.timestamp}
                    />
                ) : null}
                <div className={cn(hoverGroupClassName, 'relative -mt-0.5 min-w-0')}>
                    <div className="flex min-w-0 flex-col gap-3">
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
                    </div>
                </div>
            </MessageContent>
            {/* Mounted on first use so long transcripts don't pay a drawer per turn. */}
            {inspectMounted ? (
                <ChatTurnDrawer
                    agentCharacter={actorProfile?.character ?? agentStatusCharacter ?? null}
                    agentColor={actorProfile?.primaryColor ?? null}
                    agentName={displayName}
                    chatId={chatId}
                    embeddedEvidence={turnEvidenceSource === 'embedded'}
                    entry={entry}
                    onOpenChange={setInspectOpen}
                    open={inspectOpen}
                    turnActive={turnActive}
                />
            ) : null}
        </Message>
    );
}

// Exported for the turn drawer, which renders a turn's full segment list —
// activity groups included — outside the transcript pane.
export function AgentTurnSegment({
    activityAppearance,
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
    activityAppearance?: 'card' | 'transcript';
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
                appearance={activityAppearance}
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
    const attachments = context?.renderMessageAttachments
        ? context.renderMessageAttachments(message)
        : renderTranscriptMessageAttachments(message.attachments);
    const body = context?.renderMessageContent ? (
        context.renderMessageContent(message)
    ) : (
        <ChatTranscriptMessageContent message={message} textClassName="text-current" />
    );

    return body ? (
        <ThreadMessageSurface row={item.row}>
            <ChatMessage
                animateEnter={isLocalTimelineMessageMetadata(message.metadata) || animateLiveEnter}
                attachments={attachments}
                from={from}
            >
                {body}
            </ChatMessage>
        </ThreadMessageSurface>
    ) : null;
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
        <div className="min-w-0 max-w-[46rem] whitespace-pre-wrap break-words text-foreground text-sm leading-6 [overflow-wrap:anywhere]">
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
        <ChatMessage
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
        </ChatMessage>
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

function isStreamingActiveReply(reply: ChatActiveReply) {
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
    return (
        <CopyButton
            className={messageActionButtonClassName}
            copiedLabel="Copied message"
            disabled={disabled}
            label={disabled ? 'Copy available when complete' : 'Copy message'}
            value={value}
        />
    );
}

// cursor-default overrides the button primitive's cursor-pointer: clickable
// app chrome keeps the regular arrow cursor.
const messageActionButtonClassName =
    'inline-flex size-5 cursor-default items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted shadow-none hover:bg-transparent hover:text-foreground';

function getLastMessage(items: TranscriptItem[]) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (
            item?.kind === 'row' &&
            item.row.kind === 'message' &&
            !isActivityBackedMessageRow(item.row)
        ) {
            return item.row.message;
        }
    }

    return null;
}

function isActiveTurn(
    items: TranscriptItem[],
    activeReply: ChatActiveReply | null,
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
