import type { PressableProps } from 'react-native';
import { Keyboard, Pressable } from 'react-native';

export function KeyboardDismissArea(props: Omit<PressableProps, 'onPress'>) {
    return <Pressable accessible={false} onPress={Keyboard.dismiss} {...props} />;
}
