import { Add01Icon, SentIcon } from '@hugeicons-pro/core-solid-rounded';
import { useChatMessageSend } from '@tavern/app-client';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { InputGroup } from 'heroui-native/input-group';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { AppIcon } from '../../components/app-icon.tsx';
import { useGrottoConnectionState } from '../../lib/grotto-server-provider.tsx';
import {
    addPendingMessage,
    dropPendingMessage,
    settlePendingMessage,
    threadPendingKey,
} from './pending-messages.ts';

export function ChatComposer({
    chatId,
    chatTitle,
    isChannel,
    serverId,
}: {
    chatId: string;
    chatTitle: string;
    isChannel: boolean;
    serverId: string;
}) {
    return (
        <MessageComposer
            placeholder={`Message ${isChannel ? '#' : ''}${chatTitle}`}
            serverId={serverId}
            target={{ chatId, kind: 'chat' }}
        />
    );
}

export function ThreadComposer({
    anchorMessageId,
    onThreadCreated,
    parentChatId,
    serverId,
}: {
    anchorMessageId: string;
    onThreadCreated: (threadChatId: string) => void;
    parentChatId: string;
    serverId: string;
}) {
    return (
        <MessageComposer
            onSent={(receipt) => {
                if (receipt.threadChatId) {
                    onThreadCreated(receipt.threadChatId);
                }
            }}
            placeholder="Reply to thread"
            serverId={serverId}
            target={{ anchorMessageId, kind: 'thread', parentChatId }}
        />
    );
}

type MessageTarget =
    | { chatId: string; kind: 'chat' }
    | {
          anchorMessageId: string;
          kind: 'thread';
          parentChatId: string;
      };

function MessageComposer({
    onSent,
    placeholder,
    serverId,
    target,
}: {
    onSent?: (
        receipt: Awaited<ReturnType<ReturnType<typeof useChatMessageSend>['mutateAsync']>>
    ) => void;
    placeholder: string;
    serverId: string;
    target: MessageTarget;
}) {
    const router = useRouter();
    const connectionState = useGrottoConnectionState();
    const [draft, setDraft] = useState('');
    const draftRef = useRef('');
    const [error, setError] = useState<string | null>(null);
    const send = useChatMessageSend();
    const canSend = Boolean(draft.trim());
    const pendingChatId =
        target.kind === 'chat' ? target.chatId : threadPendingKey(target.anchorMessageId);
    const sendChatId = target.kind === 'chat' ? target.chatId : target.parentChatId;

    const submit = async () => {
        const content = draftRef.current.trim();
        if (!content) {
            return;
        }

        const nonce = randomUUID();
        draftRef.current = '';
        setDraft('');
        setError(null);
        addPendingMessage(pendingChatId, {
            content,
            createdAt: new Date().toISOString(),
            nonce,
        });

        try {
            const receipt = await send.mutateAsync({
                attachmentIds: [],
                chatId: sendChatId,
                content,
                nonce,
                serverId,
                ...(target.kind === 'thread'
                    ? { thread: { anchorMessageId: target.anchorMessageId } }
                    : {}),
            });
            settlePendingMessage({
                chatId: pendingChatId,
                messageId: receipt.message.id,
                nonce,
            });
            onSent?.(receipt);
        } catch {
            dropPendingMessage(pendingChatId, nonce);
            setDraft((current) => {
                const restoredDraft = current ? `${content}\n${current}` : content;
                draftRef.current = restoredDraft;
                return restoredDraft;
            });
            setError('Message not sent. Your draft is ready to retry.');
        }
    };

    return (
        <View className="w-full gap-1.5">
            <InputGroup className="w-full">
                <InputGroup.Input
                    accessibilityLabel={placeholder}
                    className="rounded-3xl"
                    onChangeText={(value) => {
                        draftRef.current = value;
                        setDraft(value);
                    }}
                    onSubmitEditing={() => void submit()}
                    placeholder={placeholder}
                    returnKeyType="send"
                    value={draft}
                    variant="secondary"
                />
                <InputGroup.Prefix className="px-1">
                    <Button
                        accessibilityLabel="Add attachment"
                        isIconOnly
                        onPress={() =>
                            router.push({
                                pathname: '/section/[id]',
                                params: { id: 'attachments' },
                            })
                        }
                        size="sm"
                        variant="ghost"
                    >
                        <AppIcon icon={Add01Icon} size={18} tone="muted" />
                    </Button>
                </InputGroup.Prefix>
                <InputGroup.Suffix className="px-1">
                    <Button
                        accessibilityLabel="Send message"
                        isDisabled={!canSend}
                        isIconOnly
                        onPress={() => void submit()}
                        size="sm"
                        variant={canSend ? 'primary' : 'ghost'}
                    >
                        <AppIcon
                            icon={SentIcon}
                            size={18}
                            tone={canSend ? 'accent-foreground' : 'muted'}
                        />
                    </Button>
                </InputGroup.Suffix>
            </InputGroup>
            {error ? <Text className="px-2 text-danger text-xs">{error}</Text> : null}
            {connectionState !== 'connected' && !error ? (
                <Text className="px-2 text-muted text-xs">Reconnecting…</Text>
            ) : null}
        </View>
    );
}
