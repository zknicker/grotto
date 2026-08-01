import { createRouter } from '../trpc.ts';
import { createChannelProcedure } from './create-channel.ts';
import { ensureDmProcedure } from './ensure-dm.ts';
import { readChatEventHeadProcedure } from './event-head.ts';
import { listChatEventsProcedure } from './events.ts';
import { listChatsProcedure } from './list.ts';
import { markChatReadProcedure } from './mark-read.ts';
import { listMentionOptionsProcedure } from './mention-options.ts';
import { listChatMessagesProcedure } from './messages.ts';
import { onCompositionProcedure } from './on-composition.ts';
import { onChatEventProcedure } from './on-event.ts';
import { publishCompositionProcedure } from './publish-composition.ts';
import { searchChatMessagesProcedure } from './search.ts';
import { sendChatMessageProcedure } from './send.ts';
import { updateChannelProcedure } from './update-channel.ts';

export const chatRouter = createRouter({
    createChannel: createChannelProcedure,
    ensureDm: ensureDmProcedure,
    eventHead: readChatEventHeadProcedure,
    events: listChatEventsProcedure,
    list: listChatsProcedure,
    markRead: markChatReadProcedure,
    mentionOptions: listMentionOptionsProcedure,
    messages: listChatMessagesProcedure,
    onComposition: onCompositionProcedure,
    onEvent: onChatEventProcedure,
    publishComposition: publishCompositionProcedure,
    search: searchChatMessagesProcedure,
    send: sendChatMessageProcedure,
    updateChannel: updateChannelProcedure,
});
