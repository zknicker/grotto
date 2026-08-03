import { Input, TextField } from '@heroui/react';
import * as React from 'react';
import { useUserProfilePreference } from '../../../hooks/shell/use-user-profile-preference.ts';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
} from '../layout/settings-page.tsx';

export function ProfileSettings({ serverId }: { serverId: string }) {
    const profile = useUserProfilePreference();
    const [error, setError] = React.useState<string | null>(null);
    const setAvatar = grottoTrpc.avatar.set.useMutation();
    const displayName = profile.displayName ?? '';

    return (
        <SettingsPage>
            <SettingsPageHeader title="Profile" />
            <SettingsSection title="Identity">
                <SettingsGroup>
                    <SettingsRow
                        description="Shown beside your messages."
                        error={error ?? setAvatar.error?.message ?? null}
                        title="Photo"
                        trailingWidth="intrinsic"
                    >
                        <div className="flex items-center md:justify-end">
                            <AvatarPicker
                                isDisabled={setAvatar.isPending}
                                label="profile photo"
                                name={displayName || 'You'}
                                onError={setError}
                                onSelect={async (image) => {
                                    profile.setAvatar(image.dataUrl);
                                    await setAvatar.mutateAsync({
                                        bytesBase64: image.base64,
                                        mediaType: image.mediaType,
                                        serverId,
                                        target: { kind: 'user' },
                                    });
                                }}
                                src={profile.avatarUrl}
                            />
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
