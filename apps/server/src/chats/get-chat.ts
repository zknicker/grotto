import type { Chat } from '@tavern/api';
import type { GrottoDatabase } from '../postgres/connection.ts';
import type { GrottoUser } from '../users/grotto-user.ts';
import { ChatNotFoundError } from './chat-access.ts';
import { listChats } from './list-chats.ts';

export async function getChat(
    db: GrottoDatabase,
    member: GrottoUser | null,
    input: { chatId: string; serverId: string }
): Promise<Chat> {
    const chat = (await listChats(db, member, input.serverId, 'all')).find(
        (candidate) => candidate.id === input.chatId
    );
    if (!chat) {
        throw new ChatNotFoundError();
    }
    return chat;
}
