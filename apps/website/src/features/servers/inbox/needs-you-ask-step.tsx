import { Button } from '@heroui/react';
import { useChatMessageSend } from '../../../hooks/servers/use-chat-message-send.ts';
import { askAnswerMessage, type NeedsYouAsk } from './needs-you-asks.ts';

/**
 * The recommended step as the human's own answer. Pressing it sends a real
 * Message into the Ask's Thread whose content is exactly the step text; the
 * Server settles the Ask as a side effect of that ordinary send.
 *
 * The row is never removed optimistically. A reply settles the Ask nearest to
 * it in the Thread, which is the Server's call to make, so the row leaves only
 * when `ask.updated` refetches the open-Ask list.
 */
export function NeedsYouAskStep({ ask, serverId }: { ask: NeedsYouAsk; serverId: string }) {
    const send = useChatMessageSend();

    return (
        <div className="flex min-w-0 flex-col items-end gap-1">
            <Button
                // Once this button has posted its answer it is spent. The
                // row leaves on the Ask's own event, and until it does a
                // second press would only duplicate the Message.
                isDisabled={send.isPending || send.isSuccess}
                onPress={() =>
                    send.mutate(askAnswerMessage(ask, { nonce: crypto.randomUUID(), serverId }))
                }
                size="sm"
                variant="secondary"
            >
                {ask.recommendedStep}
            </Button>
            {send.error ? <span className="text-danger text-xs">{send.error.message}</span> : null}
        </div>
    );
}
