import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

function Root({ children }: PropsWithChildren) {
    return <View className="h-16 flex-row items-center gap-2 px-3">{children}</View>;
}

function Leading({ children }: PropsWithChildren) {
    return <View className="w-11 items-start">{children}</View>;
}

function Title({ children }: PropsWithChildren) {
    return <View className="min-w-0 flex-1 items-center">{children}</View>;
}

function Trailing({ children }: PropsWithChildren) {
    return <View className="w-11 items-end">{children}</View>;
}

export const SettingsSheetHeader = { Leading, Root, Title, Trailing };
