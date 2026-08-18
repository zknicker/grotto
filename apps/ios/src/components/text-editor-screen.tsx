import { Tick02Icon } from '@hugeicons-pro/core-solid-rounded';
import { useBottomSheetAwareHandlers } from 'heroui-native';
import { Button } from 'heroui-native/button';
import type { InputProps } from 'heroui-native/input';
import { Input } from 'heroui-native/input';
import { Spinner } from 'heroui-native/spinner';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { Text, type TextInput, View } from 'react-native';
import { AppIcon } from './app-icon.tsx';

type TextEditorScreenTextareaProps = Omit<
    InputProps,
    'autoFocus' | 'background' | 'className' | 'containerClassName' | 'multiline' | 'style'
>;

function Root({ children }: PropsWithChildren) {
    return <View className="flex-1 px-5 pb-safe-offset-3">{children}</View>;
}

function Textarea(props: TextEditorScreenTextareaProps) {
    const inputRef = useRef<TextInput>(null);
    const keyboardHandlers = useBottomSheetAwareHandlers();

    useEffect(() => {
        const focusTimer = setTimeout(() => inputRef.current?.focus(), 280);
        return () => clearTimeout(focusTimer);
    }, []);

    return (
        <Input
            background={null}
            className="min-h-0 flex-1 rounded-none border-0 bg-transparent px-0 text-xl ios:shadow-none shadow-none ios:outline-0 ios:focus:outline-0"
            multiline
            onBlur={keyboardHandlers.onBlur}
            onFocus={keyboardHandlers.onFocus}
            ref={inputRef}
            style={{ borderWidth: 0, outlineWidth: 0, textAlignVertical: 'top' }}
            {...props}
        />
    );
}

function Actions({ children }: PropsWithChildren) {
    return <View className="items-end pb-2">{children}</View>;
}

function ErrorMessage({ children }: PropsWithChildren) {
    return <Text className="text-danger text-sm">{children}</Text>;
}

function Submit({
    accessibilityLabel,
    isPending,
    onPress,
}: {
    accessibilityLabel: string;
    isPending: boolean;
    onPress: () => void;
}) {
    return (
        <Button
            accessibilityLabel={accessibilityLabel}
            isDisabled={isPending}
            isIconOnly
            onPress={onPress}
            size="lg"
            variant="secondary"
        >
            {isPending ? (
                <Spinner size="sm" />
            ) : (
                <View className="size-8 items-center justify-center rounded-full bg-foreground">
                    <AppIcon icon={Tick02Icon} size={18} tone="background" />
                </View>
            )}
        </Button>
    );
}

export const TextEditorScreen = { Actions, Error: ErrorMessage, Root, Submit, Textarea };
