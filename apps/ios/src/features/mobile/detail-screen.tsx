import { BubbleChatIcon, File01Icon } from '@hugeicons-pro/core-solid-rounded';
import { Card } from 'heroui-native/card';
import { View } from 'react-native';
import { AppIcon } from './app-icon';
import { AppLayout } from './app-layout';
import { BackHeader } from './back-header';

export function DetailScreen({ kind }: { kind: 'artifact' | 'thread' }) {
    const artifact = kind === 'artifact';

    return (
        <AppLayout.Root>
            <BackHeader title={artifact ? 'iOS architecture brief' : 'Thread'} />
            <AppLayout.Content>
                <View className="flex-1 p-4">
                    <Card className="flex-1">
                        <Card.Body className="items-center justify-center px-6">
                            <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-accent-soft">
                                <AppIcon
                                    icon={artifact ? File01Icon : BubbleChatIcon}
                                    size={26}
                                    tone="accent"
                                />
                            </View>
                            <Card.Title className="text-center text-xl">
                                {artifact ? 'Native artifact route' : 'Native thread route'}
                            </Card.Title>
                            <Card.Description className="mt-2 text-center leading-5">
                                {artifact
                                    ? 'The route and controls remain native. Interactive artifact content will mount in an isolated web canvas here.'
                                    : 'Thread data will use the same shared query hooks as desktop while this screen owns iPhone rendering.'}
                            </Card.Description>
                        </Card.Body>
                    </Card>
                </View>
            </AppLayout.Content>
        </AppLayout.Root>
    );
}
