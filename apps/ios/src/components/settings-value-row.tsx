import type { IconSvgElement } from '@hugeicons/react-native';
import { ListGroup } from 'heroui-native/list-group';
import { Text } from 'react-native';
import { AppIcon } from './app-icon.tsx';

export function SettingsValueRow({
    icon,
    label,
    value,
}: {
    icon: IconSvgElement;
    label: string;
    value: string;
}) {
    return (
        <ListGroup.Item>
            <ListGroup.ItemPrefix>
                <AppIcon icon={icon} size={20} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
                <Text className="max-w-52 text-right text-base text-muted" numberOfLines={1}>
                    {value}
                </Text>
            </ListGroup.ItemSuffix>
        </ListGroup.Item>
    );
}
