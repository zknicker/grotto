import { Tick02Icon } from '@hugeicons-pro/core-solid-rounded';
import type { BottomSheetTitleProps } from 'heroui-native/bottom-sheet';
import { BottomSheet } from 'heroui-native/bottom-sheet';
import { Button } from 'heroui-native/button';
import type { InputProps } from 'heroui-native/input';
import { Input } from 'heroui-native/input';
import { Spinner } from 'heroui-native/spinner';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { Keyboard, Text, type TextInput, View } from 'react-native';
import { AppIcon } from './app-icon.tsx';

type TextEditorSheetRootProps = PropsWithChildren<{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}>;

type TextEditorSheetTextareaProps = Omit<
    InputProps,
    'autoFocus' | 'background' | 'className' | 'containerClassName' | 'multiline' | 'style'
>;

function TextEditorSheetRoot({ children, isOpen, onOpenChange }: TextEditorSheetRootProps) {
    const [keyboardHeight, setKeyboardHeight] = useState(() => Keyboard.metrics()?.height ?? 0);

    useEffect(() => {
        const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (event) =>
            setKeyboardHeight(event.endCoordinates.height)
        );
        const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    return (
        <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
            <BottomSheet.Portal>
                <BottomSheet.Overlay />
                <BottomSheet.Content
                    contentContainerClassName="h-full"
                    enableDynamicSizing={false}
                    enableOverDrag={false}
                    snapPoints={['92%']}
                >
                    <View className="flex-1" style={{ paddingBottom: keyboardHeight }}>
                        {children}
                    </View>
                </BottomSheet.Content>
            </BottomSheet.Portal>
        </BottomSheet>
    );
}

function TextEditorSheetTitle(props: Omit<BottomSheetTitleProps, 'className'>) {
    return <BottomSheet.Title className="text-center font-semibold" {...props} />;
}

function TextEditorSheetTextarea(props: TextEditorSheetTextareaProps) {
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const focusTimer = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(focusTimer);
    }, []);

    return (
        <Input
            autoFocus
            background={null}
            className="mt-5 min-h-0 flex-1 rounded-none border-0 bg-transparent px-0 text-xl ios:shadow-none shadow-none ios:outline-0 ios:focus:outline-0"
            multiline
            ref={inputRef}
            style={{ borderWidth: 0, outlineWidth: 0, textAlignVertical: 'top' }}
            {...props}
        />
    );
}

function TextEditorSheetActions({ children }: PropsWithChildren) {
    return <View className="items-end pb-2">{children}</View>;
}

function TextEditorSheetError({ children }: PropsWithChildren) {
    return <Text className="text-danger text-sm">{children}</Text>;
}

function TextEditorSheetSubmit({
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

export const TextEditorSheet = {
    Actions: TextEditorSheetActions,
    Error: TextEditorSheetError,
    Root: TextEditorSheetRoot,
    Submit: TextEditorSheetSubmit,
    Textarea: TextEditorSheetTextarea,
    Title: TextEditorSheetTitle,
};
