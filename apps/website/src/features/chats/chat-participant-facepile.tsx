import { UserIcon } from '@hugeicons-pro/core-solid-rounded';
import type * as React from 'react';
import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { localHumanParticipantId } from '../../hooks/actors/use-actor.ts';
import type { AgentFaceAppearance } from '../../hooks/agents/use-agent-appearance.ts';
import { useAgentAppearanceLookup } from '../../hooks/agents/use-agent-appearance.ts';
import { useCurrentUser } from '../../hooks/identity/use-current-user.ts';
import { useUserProfilePreference } from '../../hooks/shell/use-user-profile-preference.ts';
import { cn } from '../../lib/utils.ts';
import { resolveAgentInk } from '../agents/agent-color-presets.ts';
import { AgentFace } from './agent-face.tsx';
import { AgentHoverCard } from './agent-hover-card.tsx';
import type { ChatListItem } from './chat-list-data.ts';

// The face sits on the same circular coin as human avatars, slightly inset so
// the art clears the coin's curve.
const faceStyle = { flexShrink: 0, height: 20, overflow: 'visible', width: 20 } as const;

// Facepile avatars overlap (-space-x), so every variant needs an opaque fill
// (alpha tokens let neighbors show through) plus a background-colored cutout
// ring. Round to match user avatars everywhere else. The initials size lives
// on the inner span: merging a size token with these color classes would
// collapse them into one utility.
const participantAvatarClassName =
    'relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle font-medium text-muted-foreground shadow-[0_0_0_2px_var(--background)]';

/** Overlapping participant avatars for a chat, with a +N overflow count. */
export function ChatParticipantFacepile({ chat }: { chat: ChatListItem }) {
    const participants = getVisibleParticipants(chat);
    const lookupAppearance = useAgentAppearanceLookup();
    const { tavernUserId } = useCurrentUser();

    if (participants.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 items-center">
            <ul
                aria-label={`Participants: ${participants.map((participant) => participant.name).join(', ')}`}
                className="flex items-center -space-x-1.5"
            >
                {participants.slice(0, 5).map((participant) => (
                    <ParticipantAvatar
                        appearance={
                            participant.actorType === 'agent'
                                ? lookupAppearance(participant.actorId)
                                : null
                        }
                        chatId={chat.id}
                        key={participant.actorId}
                        participant={participant}
                        tavernUserId={tavernUserId}
                    />
                ))}
            </ul>
            {participants.length > 5 ? (
                <span className="ml-2 font-medium text-meta text-muted-foreground tabular-nums">
                    +{participants.length - 5}
                </span>
            ) : null}
        </div>
    );
}

function ParticipantAvatar({
    appearance,
    chatId,
    participant,
    tavernUserId,
}: {
    appearance: AgentFaceAppearance | null;
    chatId: string;
    participant: ChatListItem['participants'][number];
    tavernUserId: string | null;
}) {
    const dark = useResolvedThemeOptional() === 'dark';

    if (appearance && appearance.character !== 'none') {
        return (
            <li className="contents">
                <AgentHoverCard
                    agentId={participant.actorId}
                    agentName={participant.name}
                    chatId={chatId}
                    triggerClassName={cn(
                        participantAvatarClassName,
                        'cursor-pointer outline-none transition-transform hover:z-10 hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring'
                    )}
                >
                    <AgentFace
                        animate={false}
                        dark={dark}
                        head={appearance.character}
                        ink={resolveAgentInk(dark, appearance.primaryColor)}
                        size={20}
                        style={faceStyle}
                    />
                </AgentHoverCard>
            </li>
        );
    }

    if (
        participant.actorType === 'participant' &&
        (participant.actorId === localHumanParticipantId || participant.actorId === tavernUserId)
    ) {
        return <LocalUserAvatar participant={participant} />;
    }

    const style = getParticipantAvatarStyle(participant);

    return (
        <li
            className={cn(
                participantAvatarClassName,
                participant.primaryColor ? 'text-white' : null
            )}
            style={style}
            title={participant.name}
        >
            {isAvatarImage(participant.avatar) ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={24}
                    src={participant.avatar}
                    width={24}
                />
            ) : (
                <span className="text-micro">{getParticipantInitials(participant)}</span>
            )}
        </li>
    );
}

function LocalUserAvatar({ participant }: { participant: ChatListItem['participants'][number] }) {
    const profile = useUserProfilePreference();
    const title = profile.displayName ?? participant.name;

    return (
        <li className={participantAvatarClassName} title={title}>
            {profile.avatarUrl ? (
                <img
                    alt=""
                    className="size-full object-cover"
                    height={24}
                    src={profile.avatarUrl}
                    width={24}
                />
            ) : (
                <Icon aria-hidden="true" className="size-3.5" icon={UserIcon} size={14} />
            )}
        </li>
    );
}

function getVisibleParticipants(chat: ChatListItem) {
    if (chat.participants.length > 0) {
        return chat.participants;
    }

    if (!chat.targetParticipant) {
        return [];
    }

    return [
        {
            actorId: chat.targetParticipant.id,
            actorType: 'participant' as const,
            avatar: chat.targetParticipant.avatar,
            name: chat.targetParticipant.name,
            primaryColor: chat.targetParticipant.primaryColor,
        },
    ];
}

function getParticipantAvatarStyle(participant: ChatListItem['participants'][number]) {
    return participant.primaryColor
        ? ({ backgroundColor: participant.primaryColor } as React.CSSProperties)
        : undefined;
}

function getParticipantInitials(participant: ChatListItem['participants'][number]) {
    if (participant.avatar && !avatarLooksLikeImage(participant.avatar)) {
        return participant.avatar.slice(0, 2).toUpperCase();
    }

    const words = participant.name.trim().split(/\s+/u).filter(Boolean);
    const initials = words
        .slice(0, 2)
        .map((word) => word[0])
        .join('');

    return (initials || '?').toUpperCase();
}

function isAvatarImage(avatar: string | null): avatar is string {
    return Boolean(avatar && avatarLooksLikeImage(avatar));
}

function avatarLooksLikeImage(avatar: string) {
    return /^(data:image\/|https?:\/\/|blob:)/u.test(avatar);
}
