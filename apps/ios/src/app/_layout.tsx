import 'react-native-gesture-handler';
import '../global.css';

import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <HeroUINativeProvider>
                <Stack screenOptions={{ headerShown: false }} />
            </HeroUINativeProvider>
        </GestureHandlerRootView>
    );
}
