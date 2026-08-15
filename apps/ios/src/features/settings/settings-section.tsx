import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';

export function SettingsSection({ children, title }: PropsWithChildren<{ title: string }>) {
    return (
        <View className="gap-2">
            <Text className="px-1 font-medium text-muted text-sm">{title}</Text>
            {children}
        </View>
    );
}
