import 'react-native-gesture-handler';
import '../global.css';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthBoundary } from '@/features/auth/auth-boundary.tsx';
import { ServerEventBoundary } from '@/features/mobile/server-event-boundary.tsx';
import { ThemePreferenceProvider } from '@/features/settings/theme-preference.tsx';
import { appConfig } from '@/lib/app-config.ts';

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemePreferenceProvider>
                <ClerkProvider
                    publishableKey={appConfig.clerkPublishableKey}
                    tokenCache={tokenCache}
                >
                    <HeroUINativeProvider>
                        <AuthBoundary>
                            <ServerEventBoundary>
                                <Stack screenOptions={{ headerShown: false }} />
                            </ServerEventBoundary>
                        </AuthBoundary>
                    </HeroUINativeProvider>
                </ClerkProvider>
            </ThemePreferenceProvider>
        </GestureHandlerRootView>
    );
}
