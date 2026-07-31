import { Button, Input, TextField, Tooltip } from '@heroui/react';
import { Camera01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { useUserProfilePreference } from '../../../hooks/shell/use-user-profile-preference.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../layout/settings-page.tsx';
import { readAvatarImage } from './resize-image.ts';

export function ProfileSettings() {
    const profile = useUserProfilePreference();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [error, setError] = React.useState<string | null>(null);
    const displayName = profile.displayName ?? '';

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) {
            return;
        }

        setError(null);

        try {
            profile.setAvatar(await readAvatarImage(file));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'That image could not be read.');
        }
    };

    return (
        <SettingsPage>
            <SettingsPageHeader title="Profile" />
            <SettingsSection title="Identity">
                <SettingsGroup>
                    <SettingsRow
                        description="Shown beside your messages."
                        error={error}
                        title="Photo"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex items-center md:justify-end">
                            <input
                                accept="image/*"
                                className="hidden"
                                onChange={(event) => {
                                    void handleFile(event);
                                }}
                                ref={fileInputRef}
                                type="file"
                            />
                            <Tooltip delay={0}>
                                <Button
                                    aria-label={
                                        profile.avatarUrl
                                            ? 'Change profile photo'
                                            : 'Upload profile photo'
                                    }
                                    isIconOnly
                                    onPress={() => fileInputRef.current?.click()}
                                    size="lg"
                                    variant="ghost"
                                >
                                    <span className="relative">
                                        <AvatarPreview
                                            avatarUrl={profile.avatarUrl}
                                            name={displayName}
                                        />
                                        <span className="absolute -right-2 -bottom-2 inline-flex size-5 items-center justify-center rounded-full bg-surface-secondary text-muted">
                                            <Icon
                                                className="size-3"
                                                icon={Camera01Icon}
                                                strokeWidth={2.25}
                                            />
                                        </span>
                                    </span>
                                </Button>
                                <Tooltip.Content placement="top">
                                    {profile.avatarUrl
                                        ? 'Change profile photo'
                                        : 'Upload profile photo'}
                                </Tooltip.Content>
                            </Tooltip>
                        </div>
                    </SettingsRow>
                    <SettingsRow description="Leave blank to show “You”." title="Display Name">
                        <TextField
                            aria-label="Display name"
                            fullWidth
                            onChange={profile.setDisplayName}
                            value={displayName}
                            variant="secondary"
                        >
                            <Input fullWidth placeholder="You" />
                        </TextField>
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function AvatarPreview({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
    if (avatarUrl) {
        return (
            <span className="inline-flex size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
                <img
                    alt="Your avatar"
                    className="size-full object-cover"
                    height={40}
                    src={avatarUrl}
                    width={40}
                />
            </span>
        );
    }

    return (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary font-semibold text-muted text-xs ring-1 ring-border">
            {getInitials(name)}
        </span>
    );
}

function getInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return 'You';
    }

    if (parts.length === 1) {
        return parts[0]?.slice(0, 2).toUpperCase() ?? 'You';
    }

    return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}
