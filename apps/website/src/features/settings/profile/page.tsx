import { Camera01Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../../../components/ui/settings-row.tsx';
import { useUserProfilePreference } from '../../../hooks/shell/use-user-profile-preference.ts';
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
                            <Button
                                aria-label={
                                    profile.avatarUrl
                                        ? 'Change profile photo'
                                        : 'Upload profile photo'
                                }
                                className="group/avatar size-10 overflow-visible rounded-full p-0 hover:bg-transparent sm:size-10"
                                onClick={() => fileInputRef.current?.click()}
                                size="icon-lg"
                                variant="ghost"
                            >
                                <AvatarPreview avatarUrl={profile.avatarUrl} name={displayName} />
                                <span className="absolute -right-1.5 -bottom-1.5 inline-flex size-6 items-center justify-center rounded-full border border-card bg-secondary text-muted-foreground transition-colors group-hover/avatar:bg-input group-hover/avatar:text-foreground">
                                    <Icon
                                        className="size-3.5"
                                        icon={Camera01Icon}
                                        strokeWidth={2.25}
                                    />
                                </span>
                            </Button>
                        </div>
                    </SettingsRow>
                    <Separator />
                    <SettingsRow description="Leave blank to show “You”." title="Display name">
                        <Input
                            onChange={(event) => profile.setDisplayName(event.target.value)}
                            placeholder="You"
                            value={displayName}
                        />
                    </SettingsRow>
                </SettingsGroup>
            </SettingsSection>
        </SettingsPage>
    );
}

function AvatarPreview({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
    if (avatarUrl) {
        return (
            <span className="inline-flex size-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border-subtle">
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
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-caption text-muted-foreground ring-1 ring-border-subtle">
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
