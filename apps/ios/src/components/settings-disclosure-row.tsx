import type { IconSvgElement } from '@hugeicons/react-native';
import { ListGroup } from 'heroui-native/list-group';
import { AppIcon } from './app-icon.tsx';

export function SettingsDisclosureRow({
    accessibilityLabel,
    description,
    icon,
    onPress,
    title,
}: {
    accessibilityLabel?: string;
    description?: string;
    icon: IconSvgElement;
    onPress: () => void;
    title: string;
}) {
    return (
        <ListGroup.Item
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityRole="button"
            onPress={onPress}
        >
            <ListGroup.ItemPrefix>
                <AppIcon icon={icon} size={20} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{title}</ListGroup.ItemTitle>
                {description ? (
                    <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription>
                ) : null}
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix />
        </ListGroup.Item>
    );
}
