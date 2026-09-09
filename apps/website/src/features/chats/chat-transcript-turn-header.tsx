import type { MessageCause } from '@grotto/api';
import { Chip } from '@heroui/react';
import type * as React from 'react';
import { requestChatComposerMention } from '../../commands/chat-composer-mention.ts';
import { formatShortTime } from '../../lib/format.ts';
import { cn } from '../../lib/utils.ts';
import { MessageCauseMark } from './automation/message-cause-mark.tsx';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { transcriptTurnGeometry } from './chat-transcript-turn-geometry.ts';
import { MessageSessionMark } from './session/message-session-mark.tsx';
import type { SessionMark } from './session/session-mark-model.ts';

// Bios stay one quiet line: hard-capped well past any reasonable blurb, then
// CSS-truncated to whatever width the row actually has.
const turnHeaderBioMaxChars = 165;

export function TurnHeader({
    bio,
    cause,
    composerId,
    deleted = false,
    displayName,
    mentionAgentId,
    onClick,
    sessionMark,
    taskMark,
    timestamp,
}: {
    bio?: string | null;
    cause?: MessageCause | null;
    composerId?: string;
    deleted?: boolean;
    displayName: string;
    mentionAgentId?: string;
    onClick?: () => void;
    sessionMark?: TurnSessionMark | null;
    /**
     * The task mark for this turn: a background claim on the message, or the
     * receipt for one this turn answered. It trails the time — provenance
     * explains a message that already exists, while a claim is work still
     * moving, and the reader's eye should land on the message first.
     */
    taskMark?: React.ReactNode;
    timestamp: string | null;
}) {
    return (
        <div className={transcriptTurnGeometry.header}>
            <TurnHeaderName
                composerId={composerId}
                deleted={deleted}
                displayName={displayName}
                mentionAgentId={mentionAgentId}
                onClick={onClick}
            />
            {deleted ? (
                <Chip size="sm" variant="secondary">
                    DELETED
                </Chip>
            ) : null}
            {/*
             * The marks take the slot the bio would have used. Both are the
             * quiet middle of the header line, and a name, a blurb, a mark and
             * a time is one fact too many for it — when an Agent spoke because
             * something fired, or spoke having just started over, that outranks
             * what it is generally for. Cause first when both apply: why it
             * spoke comes before what it had already forgotten. Only provenance
             * lives here; what the message *is* — a Task, an Ask, delegated
             * work — states itself in the recessed surface beneath it, where
             * its lifecycle can be followed.
             */}
            {cause ? <MessageCauseMark cause={cause} /> : null}
            {sessionMark ? (
                <MessageSessionMark
                    agentId={sessionMark.agentId}
                    generation={sessionMark.generation}
                    serverId={sessionMark.serverId}
                />
            ) : null}
            {!(cause || sessionMark) && bio ? (
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
            {taskMark}
        </div>
    );
}

/**
 * The author's name, and what pressing it does. Mentioning wins over opening a
 * profile: an Agent whose name is a mention target is a name you are about to
 * type, and a name nothing can be done with is plain text rather than a
 * control that does nothing.
 */
function TurnHeaderName({
    composerId,
    deleted,
    displayName,
    mentionAgentId,
    onClick,
}: {
    composerId?: string;
    deleted: boolean;
    displayName: string;
    mentionAgentId?: string;
    onClick?: () => void;
}) {
    const className = cn(transcriptTurnGeometry.name, deleted ? 'text-muted' : 'text-foreground');
    const press =
        mentionAgentId && composerId
            ? () => requestChatComposerMention({ agentId: mentionAgentId, composerId })
            : onClick;

    if (!press) {
        return <span className={className}>{displayName}</span>;
    }

    return (
        <button
            aria-label={mentionAgentId && composerId ? `Mention ${displayName}` : undefined}
            className={cn(className, 'cursor-(--cursor-interactive) hover:underline')}
            onClick={press}
            type="button"
        >
            {displayName}
        </button>
    );
}

export function resolveMentionAgentId(
    actorId: null | string,
    actorKind: 'agent' | 'participant' | 'profile' | undefined,
    canRequestMention: boolean
) {
    return canRequestMention && actorKind === 'agent' ? (actorId ?? undefined) : undefined;
}

export function getTurnCause(items: TranscriptItem[]): MessageCause | null {
    for (const item of items) {
        if (item.kind === 'row' && item.row.kind === 'message' && item.row.message.cause) {
            return item.row.message.cause;
        }
    }

    return null;
}

export interface TurnSessionMark extends SessionMark {
    serverId: string;
}

/**
 * The turn's own restart, if the transcript-wide rule marked one of its
 * messages. A turn runs inside one session, so the first marked message in it
 * is the turn's — and without a Server to read the rotation against there is
 * nothing to hover, so the mark stays off.
 */
export function getTurnSessionMark(
    items: TranscriptItem[],
    sessionMarks: ReadonlyMap<string, SessionMark> | undefined,
    serverId: string | undefined
): TurnSessionMark | null {
    if (!(sessionMarks && serverId)) {
        return null;
    }

    for (const item of items) {
        if (item.kind !== 'row' || item.row.kind !== 'message') {
            continue;
        }

        const mark = sessionMarks.get(item.row.message.id);

        if (mark) {
            return { ...mark, serverId };
        }
    }

    return null;
}
