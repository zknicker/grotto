import type { IconSvgElement } from '@hugeicons/react-native';
import { ListGroup } from 'heroui-native/list-group';
import { Select } from 'heroui-native/select';
import { AppIcon } from './app-icon.tsx';

export interface SettingsSelectOption<Value extends string> {
    label: string;
    value: Value;
}

export function SettingsSelectRow<Value extends string>({
    icon,
    onValueChange,
    options,
    title,
    value,
}: {
    icon: IconSvgElement;
    onValueChange: (value: Value) => void;
    options: readonly SettingsSelectOption<Value>[];
    title: string;
    value: Value;
}) {
    const selectedOption = options.find((option) => option.value === value);

    return (
        <Select
            className="w-full"
            onValueChange={(option) => {
                if (option) {
                    onValueChange(option.value as Value);
                }
            }}
            value={selectedOption}
        >
            <Select.Trigger asChild variant="unstyled">
                <ListGroup.Item
                    accessibilityLabel={`${title}, ${selectedOption?.label ?? 'not selected'}`}
                    accessibilityRole="button"
                >
                    <ListGroup.ItemPrefix>
                        <AppIcon icon={icon} size={20} />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                        <ListGroup.ItemTitle>{title}</ListGroup.ItemTitle>
                    </ListGroup.ItemContent>
                    <ListGroup.ItemSuffix>
                        <Select.Value className="text-muted" placeholder="Select" />
                        <Select.TriggerIndicator className="ml-1" />
                    </ListGroup.ItemSuffix>
                </ListGroup.Item>
            </Select.Trigger>
            <Select.Portal>
                <Select.Overlay />
                <Select.Content align="end" presentation="popover">
                    {options.map((option) => (
                        <Select.Item key={option.value} label={option.label} value={option.value} />
                    ))}
                </Select.Content>
            </Select.Portal>
        </Select>
    );
}
