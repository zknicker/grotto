import type { FieldErrorRootProps } from 'heroui-native/field-error';
import { FieldError } from 'heroui-native/field-error';
import type { InputProps } from 'heroui-native/input';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import type { TextFieldRootProps } from 'heroui-native/text-field';
import { TextField } from 'heroui-native/text-field';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

function SettingsFieldRoot(props: TextFieldRootProps) {
    return <TextField {...props} />;
}

function SettingsFieldLabel({ children }: PropsWithChildren) {
    return (
        <Label className="px-3" isRequired={false}>
            <Label.Text className="font-medium text-base text-muted">{children}</Label.Text>
        </Label>
    );
}

function SettingsFieldControl({ children }: PropsWithChildren) {
    return <View className="flex-row items-center gap-2">{children}</View>;
}

function SettingsFieldInput(props: Omit<InputProps, 'variant'>) {
    return <Input variant="primary" {...props} />;
}

function SettingsFieldError(props: FieldErrorRootProps) {
    return <FieldError {...props} />;
}

export const SettingsField = {
    Control: SettingsFieldControl,
    Error: SettingsFieldError,
    Input: SettingsFieldInput,
    Label: SettingsFieldLabel,
    Root: SettingsFieldRoot,
};
