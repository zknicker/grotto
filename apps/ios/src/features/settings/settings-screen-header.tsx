import { ArrowLeft02Icon, Cancel01Icon } from '@hugeicons-pro/core-stroke-rounded';
import { BottomSheet } from 'heroui-native/bottom-sheet';
import { Button } from 'heroui-native/button';
import { AppIcon } from '../../components/app-icon.tsx';
import { SettingsSheetHeader } from '../../components/settings-sheet-header.tsx';

export function SettingsRootHeader({ onClose }: { onClose: () => void }) {
    return (
        <SettingsSheetHeader.Root>
            <SettingsSheetHeader.Leading />
            <SettingsSheetHeader.Title>
                <BottomSheet.Title className="font-semibold text-lg">Settings</BottomSheet.Title>
            </SettingsSheetHeader.Title>
            <SettingsSheetHeader.Trailing>
                <Button
                    accessibilityLabel="Close settings"
                    isIconOnly
                    onPress={onClose}
                    size="sm"
                    variant="secondary"
                >
                    <AppIcon icon={Cancel01Icon} />
                </Button>
            </SettingsSheetHeader.Trailing>
        </SettingsSheetHeader.Root>
    );
}

export function SettingsBackHeader({ onBack, title }: { onBack: () => void; title: string }) {
    return (
        <SettingsSheetHeader.Root>
            <SettingsSheetHeader.Leading>
                <Button
                    accessibilityLabel="Go back"
                    isIconOnly
                    onPress={onBack}
                    size="sm"
                    variant="secondary"
                >
                    <AppIcon icon={ArrowLeft02Icon} />
                </Button>
            </SettingsSheetHeader.Leading>
            <SettingsSheetHeader.Title>
                <BottomSheet.Title className="font-semibold text-lg">{title}</BottomSheet.Title>
            </SettingsSheetHeader.Title>
            <SettingsSheetHeader.Trailing />
        </SettingsSheetHeader.Root>
    );
}
