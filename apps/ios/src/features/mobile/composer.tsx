import { Add01Icon, SentIcon } from '@hugeicons-pro/core-solid-rounded';
import { useChatMessageSend } from '@tavern/app-client';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { InputGroup } from 'heroui-native/input-group';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useGrottoConnectionState } from '../../lib/grotto-server-provider';
import { AppIcon } from './app-icon';
import { addPendingMessage, dropPendingMessage, settlePendingMessage } from './pending-messages';

export function Composer({
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
    const router = useRouter();
    const connectionState = useGrottoConnectionState();
    const [draft, setDraft] = useState('');
    const draftRef = useRef('');
    const [error, setError] = useState<string | null>(null);
    const send = useChatMessageSend();
    const canSend = Boolean(draft.trim());
    const placeholder = `Message ${isChannel ? '#' : ''}${chatTitle}`;

    const submit = async () => {
        const content = draftRef.current.trim();
        if (!content) {
            return;
        }

        const nonce = randomUUID();
        draftRef.current = '';
        setDraft('');
        setError(null);
        addPendingMessage(chatId, {
            content,
            createdAt: new Date().toISOString(),
            nonce,
        });

        try {
            const receipt = await send.mutateAsync({
                attachmentIds: [],
                chatId,
                content,
                nonce,
                serverId,
            });
            settlePendingMessage({ chatId, messageId: receipt.message.id, nonce });
        } catch {
            dropPendingMessage(chatId, nonce);
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
