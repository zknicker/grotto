import { avatarMediaTypes } from '@grotto/api/avatar';
import { Button, Tooltip } from '@heroui/react';
import { Camera01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import type { EntityAvatarProps } from '../../components/ui/entity-avatar.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import type { AvatarImage } from './resize-avatar-image.ts';
import { readAvatarImage } from './resize-avatar-image.ts';

export interface AvatarPickerProps {
    isDisabled?: boolean;
    /** Noun the button and tooltip act on, e.g. `profile photo`. */
    label: string;
    name: string;
    onError?: (message: string | null) => void;
    onSelect: (image: AvatarImage) => Promise<void> | void;
    size?: EntityAvatarProps['size'];
    src: string | null;
}

/**
 * The one avatar upload control: pick a file, crop and resize it here, and
 * hand the caller the finished image. Callers own where it is stored and how
 * a failure is presented.
 */
export function AvatarPicker({
    isDisabled,
    label,
    name,
    onError,
    onSelect,
    size = 'md',
    src,
}: AvatarPickerProps): React.ReactElement {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const action = `${src ? 'Change' : 'Upload'} ${label}`;

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        onError?.(null);

        try {
            await onSelect(await readAvatarImage(file));
        } catch (cause) {
            onError?.(cause instanceof Error ? cause.message : 'That image could not be read.');
        }
    };

    return (
        <>
            <input
                accept={avatarMediaTypes.join(',')}
                className="hidden"
                onChange={(event) => {
                    void handleFile(event);
                }}
                ref={inputRef}
                type="file"
            />
            <Tooltip delay={0}>
                <Button
                    aria-label={action}
                    className={
                        typeof size === 'number' && size > 48 ? 'h-auto w-auto p-1' : undefined
                    }
                    isDisabled={isDisabled}
                    isIconOnly
                    onPress={() => inputRef.current?.click()}
                    size="lg"
                    variant="ghost"
                >
                    <span className="relative">
                        <EntityAvatar name={name} size={size} src={src} />
                        <span className="absolute -right-2 -bottom-2 inline-flex size-5 items-center justify-center rounded-full bg-surface-secondary text-muted">
                            <Icon className="size-3" icon={Camera01Icon} strokeWidth={2.25} />
                        </span>
                    </span>
                </Button>
                <Tooltip.Content placement="top">{action}</Tooltip.Content>
            </Tooltip>
        </>
    );
}
