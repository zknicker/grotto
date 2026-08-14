import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function Root({ children }: PropsWithChildren) {
    return (
        <SafeAreaView className="bg-background" edges={['top', 'bottom']} style={{ flex: 1 }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {children}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function Header({ children }: PropsWithChildren) {
    return <View className="h-14 flex-row items-center gap-2 px-2">{children}</View>;
}

function Content({ children }: PropsWithChildren) {
    return <View style={{ flex: 1 }}>{children}</View>;
}

function Footer({ children }: PropsWithChildren) {
    return <View className="bg-background px-3 py-2">{children}</View>;
}

export const AppLayout = { Content, Footer, Header, Root };
