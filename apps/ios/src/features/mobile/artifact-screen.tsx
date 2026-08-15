import { File01Icon } from '@hugeicons-pro/core-solid-rounded';
import { Card } from 'heroui-native/card';
import { View } from 'react-native';
import { AppIcon } from './app-icon.tsx';
import { AppLayout } from './app-layout.tsx';
import { BackHeader } from './back-header.tsx';

export function ArtifactScreen() {
    return (
        <AppLayout.Root>
            <BackHeader title="iOS architecture brief" />
            <AppLayout.Content>
                <View className="flex-1 p-4">
                    <Card className="flex-1">
                        <Card.Body className="items-center justify-center px-6">
                            <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-accent-soft">
                                <AppIcon icon={File01Icon} size={26} tone="accent" />
                            </View>
                            <Card.Title className="text-center text-xl">
                                Native artifact route
                            </Card.Title>
                            <Card.Description className="mt-2 text-center leading-5">
                                The route and controls remain native. Interactive artifact content
                                will mount in an isolated web canvas here.
                            </Card.Description>
                        </Card.Body>
                    </Card>
                </View>
            </AppLayout.Content>
        </AppLayout.Root>
    );
}
