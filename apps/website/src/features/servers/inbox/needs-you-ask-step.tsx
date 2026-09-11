import type { OpenAsk } from '@grotto/api';
import { Button } from '@heroui/react';
import { useChatMessageSend } from '../../../hooks/servers/use-chat-message-send.ts';
import { askAnswerMessage } from './needs-you-asks.ts';

/**
 * The recommended step as the human's own answer. Pressing it sends a real
 * Message into the Ask's Thread whose content is exactly the step text; the
 * Server settles the Ask as a side effect of that ordinary send.
 *
 * It is offered inside the Ask's Thread peek, above the composer that would
 * otherwise carry the same words. An Ask's own text does not fit in an Inbox
 * row, so a row is no place to commit to an answer — the step belongs where
 * the question, the Agent's reasoning, and the replies are all readable, next
 * to the other way of answering.
 *
 * The Ask is never settled optimistically. A reply settles the Ask nearest to
 * it in the Thread, which is the Server's call to make, so the peek and the
 * Inbox row both leave only when `ask.updated` refetches the open-Ask list.
 */
export function NeedsYouAskStep({ ask, serverId }: { ask: OpenAsk; serverId: string }) {
    const send = useChatMessageSend();

    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <Button
                // Once this button has posted its answer it is spent. The Ask
                // leaves on its own event, and until it does a second press
                // would only duplicate the Message.
                isDisabled={send.isPending || send.isSuccess}
                onPress={() =>
                    send.mutate(askAnswerMessage(ask, { nonce: crypto.randomUUID(), serverId }))
                }
                size="sm"
                variant="secondary"
            >
                {ask.ask.recommendedStep}
            </Button>
            {send.error ? <span className="text-danger text-xs">{send.error.message}</span> : null}
        </div>
    );
}
