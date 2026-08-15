import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

export function SettingsSection({ children, title }: PropsWithChildren<{ title: string }>) {
    return (
        <View className="gap-2">
            <Text className="px-3 font-medium text-base text-muted">{title}</Text>
            {children}
        </View>
    );
}
