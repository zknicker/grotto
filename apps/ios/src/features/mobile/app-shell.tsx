import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColor } from 'heroui-native/hooks';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { ChatScreen } from './chat-screen';
import { chats } from './fixtures';
import { Sidebar } from './sidebar';

const SPRING = { damping: 26, mass: 0.82, stiffness: 260 };

export function AppShell() {
    const router = useRouter();
    const { chat: chatParam } = useLocalSearchParams<{ chat?: string | string[] }>();
    const { width } = useWindowDimensions();
    const background = useThemeColor('background');
    const drawerWidth = Math.min(width * 0.77, 330);
    const [isOpen, setIsOpen] = useState(false);
    const offset = useSharedValue(0);
    const gestureStart = useSharedValue(0);
    const requestedChat = Array.isArray(chatParam) ? chatParam[0] : chatParam;
    const activeChatId =
        requestedChat && chats.some((chat) => chat.id === requestedChat)
            ? requestedChat
            : 'channel-all';
    const activeChat = chats.find((chat) => chat.id === activeChatId) ?? chats[0];

    const settleDrawer = (open: boolean) => {
        setIsOpen(open);
        offset.value = withSpring(open ? drawerWidth : 0, SPRING);
    };

    const drawerGesture = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
        .onStart(() => {
            gestureStart.value = offset.value;
        })
        .onUpdate((event) => {
            offset.value = Math.min(
                drawerWidth,
                Math.max(0, gestureStart.value + event.translationX)
            );
        })
        .onEnd((event) => {
            const projectedOffset = offset.value + event.velocityX * 0.12;
            const shouldOpen = projectedOffset > drawerWidth / 2;
            runOnJS(setIsOpen)(shouldOpen);
            offset.value = withSpring(shouldOpen ? drawerWidth : 0, SPRING);
        });

    const canvasStyle = useAnimatedStyle(() => ({
        shadowOpacity: interpolate(offset.value, [0, drawerWidth], [0, 0.16]),
        transform: [{ translateX: offset.value }],
    }));
    const canvasClipStyle = useAnimatedStyle(() => ({
        borderBottomLeftRadius: interpolate(offset.value, [0, drawerWidth], [0, 42]),
        borderTopLeftRadius: interpolate(offset.value, [0, drawerWidth], [0, 42]),
    }));

    if (!activeChat) {
        return null;
    }

    const selectChat = (id: string) => {
        router.setParams({ chat: id });
        settleDrawer(false);
    };

    return (
        <View className="flex-1 bg-background">
            <View
                accessibilityElementsHidden={!isOpen}
                importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
                pointerEvents={isOpen ? 'auto' : 'none'}
                style={[styles.drawer, { width: drawerWidth }]}
            >
                <Sidebar
                    activeChat={activeChatId}
                    onNavigate={() => settleDrawer(false)}
                    onSelectChat={selectChat}
                />
            </View>
            <GestureDetector gesture={drawerGesture}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.canvas, canvasStyle]}>
                    <Animated.View
                        style={[
                            styles.canvasClip,
                            { backgroundColor: background },
                            canvasClipStyle,
                        ]}
                    >
                        <ChatScreen
                            chat={activeChat}
                            isSidebarOpen={isOpen}
                            onToggleSidebar={() => settleDrawer(!isOpen)}
                        />
                    </Animated.View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = {
    canvas: {
        shadowColor: '#000',
        shadowOffset: { height: 0, width: -10 },
        shadowRadius: 24,
    },
    canvasClip: {
        flex: 1,
        overflow: 'hidden' as const,
    },
    drawer: {
        bottom: 0,
        left: 0,
        position: 'absolute' as const,
        top: 0,
    },
};
