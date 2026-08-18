import { Children, isValidElement, type PropsWithChildren, useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, {
    type SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

export function SheetStack({ activeIndex, children }: PropsWithChildren<{ activeIndex: number }>) {
    const progress = useSharedValue(activeIndex);

    useEffect(() => {
        progress.value = withTiming(activeIndex, { duration: 240 });
    }, [activeIndex, progress]);

    return (
        <View className="flex-1 overflow-hidden">
            {Children.toArray(children).map((screen, index) => (
                <SheetStackScreen
                    activeIndex={activeIndex}
                    index={index}
                    key={isValidElement(screen) ? screen.key : `screen:${String(screen)}`}
                    progress={progress}
                >
                    {screen}
                </SheetStackScreen>
            ))}
        </View>
    );
}

function SheetStackScreen({
    activeIndex,
    children,
    index,
    progress,
}: PropsWithChildren<{
    activeIndex: number;
    index: number;
    progress: SharedValue<number>;
}>) {
    const { width } = useWindowDimensions();
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: (index - progress.value) * width }],
    }));
    const isActive = index === activeIndex;

    return (
        <Animated.View
            accessibilityElementsHidden={!isActive}
            className="absolute inset-0"
            pointerEvents={isActive ? 'auto' : 'none'}
            style={animatedStyle}
        >
            {children}
        </Animated.View>
    );
}
