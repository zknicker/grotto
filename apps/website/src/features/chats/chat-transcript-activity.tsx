import {
    getActivityEnd,
    getActivityStart,
    isActiveActivityItem,
    isActivityItem,
} from './chat-transcript-activity-utils.ts';
import type { TranscriptItem } from './chat-transcript-model.ts';
import { WorkingLog } from './working-log.tsx';

export function ChatTranscriptActivity({
    chatId,
    currentSessionKey,
    item,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    item: TranscriptItem;
}) {
    return (
        <ChatTranscriptActivityGroup
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            items={[item]}
        />
    );
}

export function ChatTranscriptActivityGroup({
    chatId,
    currentSessionKey,
    defaultOpen,
    items,
    showDurationHeader = true,
    turnActive = false,
    turnCompletedAt,
    turnStopped = false,
    turnStartedAt,
}: {
    chatId?: string;
    currentSessionKey?: string | null;
    defaultOpen?: boolean;
    items: TranscriptItem[];
    showDurationHeader?: boolean;
    turnActive?: boolean;
    turnCompletedAt?: string | null;
    turnStopped?: boolean;
    turnStartedAt?: string | null;
}) {
    const activityItems = items.filter(isActivityItem);
    const isActive = !turnStopped && (turnActive || activityItems.some(isActiveActivityItem));
    const activityEnd = getActivityEnd(activityItems);
    const activityStart = getActivityStart(activityItems);
    const start = activityStart ?? (isActive ? null : (turnStartedAt ?? null));
    const end = isActive ? null : activityEnd ? (turnCompletedAt ?? activityEnd) : null;

    if (activityItems.length === 0) {
        return null;
    }

    // Every group renders as the drawer from its first step — the header
    // exists before the second tool arrives, so growth only retexts it. A
    // late drawer would replace flat rows mid-turn and shift the layout.
    return (
        <WorkingLog
            animateEnter={isActive}
            chatId={chatId}
            currentSessionKey={currentSessionKey}
            defaultOpen={defaultOpen}
            end={end}
            items={activityItems}
            showDurationHeader={showDurationHeader}
            start={start}
            status={isActive ? 'active' : 'completed'}
        />
    );
}
