import 'react-native-gesture-handler';
import '../global.css';

import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthBoundary } from '@/features/auth/auth-boundary';
import { appConfig } from '@/lib/app-config';

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ClerkProvider publishableKey={appConfig.clerkPublishableKey} tokenCache={tokenCache}>
                <HeroUINativeProvider>
                    <AuthBoundary>
                        <Stack screenOptions={{ headerShown: false }} />
                    </AuthBoundary>
                </HeroUINativeProvider>
            </ClerkProvider>
        </GestureHandlerRootView>
    );
}
