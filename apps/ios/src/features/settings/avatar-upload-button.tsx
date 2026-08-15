import { Camera01Icon } from '@hugeicons-pro/core-solid-rounded';
import { Button } from 'heroui-native/button';
import { Spinner } from 'heroui-native/spinner';
import { AppIcon } from '../mobile/app-icon.tsx';
import { type PickedAvatarImage, pickAvatarImage } from './pick-avatar-image.ts';

export function AvatarUploadButton({
    isPending,
    label,
    onError,
    onSelect,
}: {
    isPending: boolean;
    label: string;
    onError: (message: string | null) => void;
    onSelect: (image: PickedAvatarImage) => Promise<void>;
}) {
    const selectPhoto = async () => {
        onError(null);
        try {
            const image = await pickAvatarImage();
            if (image) {
                await onSelect(image);
            }
        } catch (cause) {
            onError(cause instanceof Error ? cause.message : 'That photo could not be read.');
        }
    };

    return (
        <Button
            accessibilityLabel={label}
            isDisabled={isPending}
            onPress={() => void selectPhoto()}
            size="sm"
            variant="secondary"
        >
            {isPending ? <Spinner size="sm" /> : <AppIcon icon={Camera01Icon} size={16} />}
            <Button.Label>{isPending ? 'Uploading…' : 'Change photo'}</Button.Label>
        </Button>
    );
}
