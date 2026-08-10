import { createRouter } from '../trpc.ts';
import { archiveChannelProcedure } from './archive-channel.ts';
import { createChannelProcedure } from './create-channel.ts';
import { deleteChannelProcedure } from './delete-channel.ts';
import { ensureDmProcedure } from './ensure-dm.ts';
import { readChatEventHeadProcedure } from './event-head.ts';
import { listChatEventsProcedure } from './events.ts';
import { getChatProcedure } from './get.ts';
import { listChatsProcedure } from './list.ts';
import { listArchivedChatsProcedure } from './list-archived.ts';
import { markChatReadProcedure } from './mark-read.ts';
import { listMentionOptionsProcedure } from './mention-options.ts';
import { listChatMessagesProcedure } from './messages.ts';
import { onCompositionProcedure } from './on-composition.ts';
import { onChatEventProcedure } from './on-event.ts';
import { publishCompositionProcedure } from './publish-composition.ts';
import { searchChatMessagesProcedure } from './search.ts';
import { sendChatMessageProcedure } from './send.ts';
import { unarchiveChannelProcedure } from './unarchive-channel.ts';
import { updateChannelProcedure } from './update-channel.ts';

export const chatRouter = createRouter({
    archiveChannel: archiveChannelProcedure,
    createChannel: createChannelProcedure,
    deleteChannel: deleteChannelProcedure,
    ensureDm: ensureDmProcedure,
    get: getChatProcedure,
    eventHead: readChatEventHeadProcedure,
    events: listChatEventsProcedure,
    list: listChatsProcedure,
    listArchived: listArchivedChatsProcedure,
    markRead: markChatReadProcedure,
    mentionOptions: listMentionOptionsProcedure,
    messages: listChatMessagesProcedure,
    onComposition: onCompositionProcedure,
    onEvent: onChatEventProcedure,
    publishComposition: publishCompositionProcedure,
    search: searchChatMessagesProcedure,
    send: sendChatMessageProcedure,
    updateChannel: updateChannelProcedure,
    unarchiveChannel: unarchiveChannelProcedure,
});
