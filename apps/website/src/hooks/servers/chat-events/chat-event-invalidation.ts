import type { QueryClient } from '@tanstack/react-query';
import type { grottoTrpc } from '../../../lib/grotto-server.tsx';
import type { ChatEventOf, ChatEventType } from './chat-event-registry.ts';

/** The tRPC cache handle every Chat event listener invalidates through. */
export type ChatEventUtils = ReturnType<typeof grottoTrpc.useUtils>;

/** What one listener needs to invalidate the reads its own events change. */
export interface ChatEventInvalidation<Type extends ChatEventType> {
    events: ChatEventOf<Type>[];
    queryClient: QueryClient;
    serverId: string;
    utils: ChatEventUtils;
}

/** One pass refetches a Chat's read once, however many of its events arrived. */
export function uniqueChatIds(chatIds: readonly string[]): string[] {
    return [...new Set(chatIds)];
}
