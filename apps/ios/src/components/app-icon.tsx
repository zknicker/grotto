import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { useThemeColor } from 'heroui-native/hooks';

export type AppIconTone =
    | 'accent'
    | 'accent-foreground'
    | 'accent-soft-foreground'
    | 'background'
    | 'default-foreground'
    | 'muted'
    | 'success';

export function AppIcon({
    icon,
    size = 18,
    tone = 'default-foreground',
}: {
    icon: IconSvgElement;
    size?: number;
    tone?: AppIconTone;
}) {
    const color = useThemeColor(tone);

    return <HugeiconsIcon color={color} icon={icon} size={size} />;
}
