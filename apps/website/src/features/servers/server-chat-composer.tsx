import * as React from 'react';
import {
    PromptInput,
    PromptInputActions,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
} from '../../components/ui/prompt-input.tsx';
import { useSendServerChatMessage } from '../../hooks/servers/use-send-server-chat-message.ts';
import { useServerChatComposition } from '../../hooks/servers/use-server-chat-composition.ts';

export function ServerChatComposer({
    chatId,
    chatName,
    compositionChatId,
    onThreadCreated,
    placeholder,
    serverId,
    thread,
}: {
    chatId: string;
    chatName: string;
    compositionChatId: string | undefined;
    onThreadCreated?: (threadChatId: string) => void;
    placeholder?: string;
    serverId: string;
    thread?: { anchorMessageId: string };
}) {
    const [draft, setDraft] = React.useState('');
    const [compositionId] = React.useState(() => crypto.randomUUID());
    const send = useSendServerChatMessage();
    const composition = useServerChatComposition(serverId, compositionChatId);
    const publishComposition = composition.publish.mutate;

    React.useEffect(() => {
        if (draft.length === 0 || compositionChatId === undefined) {
            return;
        }

        const timeout = window.setTimeout(() => {
            publishComposition({
                chatId: compositionChatId,
                compositionId,
                serverId,
                text: draft,
            });
        }, 150);

        return () => window.clearTimeout(timeout);
    }, [compositionChatId, compositionId, draft, publishComposition, serverId]);

    React.useEffect(
        () => () => {
            if (compositionChatId) {
                publishComposition({
                    chatId: compositionChatId,
                    compositionId,
                    serverId,
                    text: null,
                });
            }
        },
        [compositionChatId, compositionId, publishComposition, serverId]
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const content = draft.trim();

        if (content.length === 0 || send.isPending) {
            return;
        }

        const receipt = await send.mutateAsync({
            chatId,
            content,
            nonce: crypto.randomUUID(),
            serverId,
            thread,
        });
        if (receipt.threadChatId) {
            onThreadCreated?.(receipt.threadChatId);
        }
        setDraft('');
        if (compositionChatId) {
            publishComposition({
                chatId: compositionChatId,
                compositionId,
                serverId,
                text: null,
            });
        }
    };

    return (
        <div>
            {composition.compositions.length > 0 ? (
                <p className="mx-auto mb-1 w-full max-w-[60rem] px-9 text-muted-foreground text-xs">
                    Someone is typing…
                </p>
            ) : null}
            <PromptInput error={send.error?.message} onSubmit={handleSubmit}>
                <PromptInputBody>
                    <PromptInputTextarea
                        aria-label={`Message ${chatName}`}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={placeholder ?? `Message ${chatName}`}
                        value={draft}
                    />
                </PromptInputBody>
                <PromptInputFooter>
                    <span />
                    <PromptInputActions>
                        <PromptInputSubmit
                            canSubmit={draft.trim().length > 0}
                            disabled={send.isPending}
                        />
                    </PromptInputActions>
                </PromptInputFooter>
            </PromptInput>
        </div>
    );
}
