import { Add01Icon, SentIcon } from '@hugeicons-pro/core-solid-rounded';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { InputGroup } from 'heroui-native/input-group';
import { useState } from 'react';
import { AppIcon } from './app-icon';

export function Composer({ chatTitle, isChannel }: { chatTitle: string; isChannel: boolean }) {
    const router = useRouter();
    const [draft, setDraft] = useState('');
    const canSend = Boolean(draft.trim());
    const placeholder = `Message ${isChannel ? '#' : ''}${chatTitle}`;

    return (
        <InputGroup className="w-full">
            <InputGroup.Input
                accessibilityLabel={placeholder}
                className="rounded-3xl"
                onChangeText={setDraft}
                placeholder={placeholder}
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
                    onPress={() => setDraft('')}
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
    );
}
