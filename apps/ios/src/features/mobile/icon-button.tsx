import type { IconSvgElement } from '@hugeicons/react-native';
import { Button } from 'heroui-native/button';
import { AppIcon } from '../../components/app-icon.tsx';

interface IconButtonProps {
    icon: IconSvgElement;
    label: string;
    onPress: () => void;
}

export function IconButton({ icon, label, onPress }: IconButtonProps) {
    return (
        <Button accessibilityLabel={label} isIconOnly onPress={onPress} size="sm" variant="ghost">
            <AppIcon icon={icon} size={19} />
        </Button>
    );
}
