import { ArrowLeft02Icon } from '@hugeicons-pro/core-solid-rounded';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Text } from 'react-native';
import { AppIcon } from './app-icon.tsx';
import { AppLayout } from './app-layout.tsx';

export function BackHeader({ onBack, title }: { onBack?: () => void; title: string }) {
    const router = useRouter();
    return (
        <AppLayout.Header>
            <Button
                accessibilityLabel="Go back"
                isIconOnly
                onPress={onBack ?? (() => router.back())}
                size="sm"
                variant="ghost"
            >
                <AppIcon icon={ArrowLeft02Icon} />
            </Button>
            <Text
                className="min-w-0 flex-1 font-semibold text-foreground text-lg"
                numberOfLines={1}
            >
                {title}
            </Text>
        </AppLayout.Header>
    );
}
