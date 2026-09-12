import type { OpenAsk } from '@haus/api';
import { Button } from '@heroui/react';
import { useChatMessageSend } from '../../../hooks/servers/use-chat-message-send.ts';
import { askAnswerMessage } from './needs-you-asks.ts';

/**
 * The Agent's offered options as the human's own answer. Pressing one sends a
 * real Message into the Ask's Thread whose content is exactly that option's
 * text; the Server settles the Ask as a side effect of that ordinary send.
 *
 * The row reads in the order the Agent wrote it, the recommendation first and
 * emphasized. An Ask with no options is an open question, and offers nothing
 * here — the composer below is the whole answer.
 *
 * It is offered inside the Ask's Thread peek, above the composer that would
 * otherwise carry the same words. An Ask's own text does not fit in an Inbox
 * row, so a row is no place to commit to an answer — the options belong where
 * the question, the Agent's reasoning, and the replies are all readable, next
 * to the other way of answering.
 *
 * The Ask is never settled optimistically. A reply settles the Ask nearest to
 * it in the Thread, which is the Server's call to make, so the peek and the
 * Inbox row both leave only when `ask.updated` refetches the open-Ask list.
 */
export function NeedsYouAskOptions({ ask, serverId }: { ask: OpenAsk; serverId: string }) {
    const send = useChatMessageSend();
    const options = ask.ask.options;

    if (options.length === 0) {
        return null;
    }

    // One press spends the whole row. The Ask leaves on its own event, and
    // until it does a second press would only post a second answer.
    const spent = send.isPending || send.isSuccess;

    return (
        <div className="flex min-w-0 flex-col items-start gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {options.map((option, index) => (
                    <Button
                        isDisabled={spent}
                        key={option}
                        onPress={() =>
                            send.mutate(
                                askAnswerMessage(ask, {
                                    nonce: crypto.randomUUID(),
                                    option,
                                    serverId,
                                })
                            )
                        }
                        size="sm"
                        variant={index === 0 ? 'primary' : 'secondary'}
                    >
                        {option}
                    </Button>
                ))}
            </div>
            {send.error ? <span className="text-danger text-xs">{send.error.message}</span> : null}
        </div>
    );
}
