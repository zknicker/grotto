import type { FieldErrorRootProps } from 'heroui-native/field-error';
import { FieldError } from 'heroui-native/field-error';
import type { InputProps } from 'heroui-native/input';
import { Input } from 'heroui-native/input';
import { Label } from 'heroui-native/label';
import type { ListGroupItemProps, ListGroupItemTitleProps } from 'heroui-native/list-group';
import { ListGroup } from 'heroui-native/list-group';
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

function SettingsFieldIngress({ children, ...props }: ListGroupItemProps) {
    return (
        <ListGroup>
            <ListGroup.Item {...props}>
                <ListGroup.ItemContent>{children}</ListGroup.ItemContent>
                <ListGroup.ItemSuffix />
            </ListGroup.Item>
        </ListGroup>
    );
}

function SettingsFieldValue(props: ListGroupItemTitleProps) {
    return <ListGroup.ItemTitle {...props} />;
}

function SettingsFieldPlaceholder({ className, ...props }: ListGroupItemTitleProps) {
    return <ListGroup.ItemTitle className={`text-muted ${className ?? ''}`} {...props} />;
}

function SettingsFieldError(props: FieldErrorRootProps) {
    return <FieldError {...props} />;
}

export const SettingsField = {
    Control: SettingsFieldControl,
    Error: SettingsFieldError,
    Ingress: SettingsFieldIngress,
    Input: SettingsFieldInput,
    Label: SettingsFieldLabel,
    Placeholder: SettingsFieldPlaceholder,
    Root: SettingsFieldRoot,
    Value: SettingsFieldValue,
};
