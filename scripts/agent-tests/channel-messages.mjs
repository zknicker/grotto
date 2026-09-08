/** Fresh scenario-owned channels include ordinary and task Threads alike. */
export async function readChannelMessages(kit, chatId) {
    const messages = [...(await kit.readMessages(chatId))];
    const page = await kit.trpc('chat.messages', {
        chatId,
        limit: 100,
        serverId: kit.serverId,
    });
    for (const thread of page.threads) {
        await kit.trackChat(thread.threadChatId);
        messages.push(...(await kit.readMessages(thread.threadChatId)));
    }
    return messages;
}
