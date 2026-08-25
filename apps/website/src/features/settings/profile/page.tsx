import type { ServerMember } from '@grotto/api/membership';
import { Input, Separator, TextField } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { useHumanAvatar } from '../../../hooks/members/use-human-avatar.ts';
import { useHumanIdentity } from '../../../hooks/members/use-human-identity.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { humanDisplayName } from '../../servers/human-identity.ts';
import { PageColumn } from '../../shell/page-column.tsx';
import { SettingsPageHeader } from '../layout/settings-page.tsx';
import { SettingsRowError } from '../layout/settings-text.tsx';

export function ProfileSettings({ serverId }: { serverId: string }) {
    const directory = useMembers(serverId);
    const viewer = directory.data?.members.find(
        (member) => member.userId === directory.data.viewerUserId
    );

    if (!viewer) {
        return (
            <PageColumn>
                <SettingsPageHeader title="Profile" />
            </PageColumn>
        );
    }

    return (
        <ProfileIdentity
            key={`${viewer.userId}:${viewer.displayName ?? ''}`}
            serverId={serverId}
            viewer={viewer}
        />
    );
}

function ProfileIdentity({ serverId, viewer }: { serverId: string; viewer: ServerMember }) {
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const [displayName, setDisplayName] = React.useState(viewer.displayName ?? '');
    const setAvatar = useHumanAvatar(serverId, viewer.userId);
    const updateProfile = useHumanIdentity(serverId, viewer.userId);

    const saveDisplayName = async () => {
        const nextName = displayName.trim();

        if (!nextName || nextName === viewer.displayName) {
            setDisplayName(viewer.displayName ?? '');
            return;
        }

        await updateProfile.save({
            description: viewer.description ?? '',
            displayName: nextName,
        });
    };

    return (
        <PageColumn>
            <SettingsPageHeader title="Profile" />
            <ItemCardGroup variant="transparent">
                <ItemCardGroup.Header>
                    <ItemCardGroup.Title>Identity</ItemCardGroup.Title>
                </ItemCardGroup.Header>
                <ItemCardGroup className="overflow-hidden">
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Title>Photo</ItemCard.Title>
                            <ItemCard.Description>Shown beside your messages.</ItemCard.Description>
                            <SettingsRowError>
                                {avatarError ?? setAvatar.error?.message}
                            </SettingsRowError>
                        </ItemCard.Content>
                        {/* The picker's edit badge overhangs its own box by 8px,
                            so the slot buys that back to keep the row's trailing
                            padding even with every other row. */}
                        <ItemCard.Action className="pe-2">
                            <AvatarPicker
                                isDisabled={setAvatar.isPending}
                                label="profile photo"
                                name={humanDisplayName(viewer)}
                                onError={setAvatarError}
                                onSelect={async (image) => {
                                    await setAvatar.mutateAsync({
                                        bytesBase64: image.base64,
                                        mediaType: image.mediaType,
                                        serverId,
                                        target: { kind: 'user' },
                                    });
                                }}
                                src={viewer.avatarUrl}
                            />
                        </ItemCard.Action>
                    </ItemCard>
                    <Separator />
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Title>Display Name</ItemCard.Title>
                            <ItemCard.Description>Shown beside your messages.</ItemCard.Description>
                            <SettingsRowError>{updateProfile.error?.message}</SettingsRowError>
                        </ItemCard.Content>
                        <ItemCard.Action>
                            {/* The field is the row's control, so it carries a
                                readable measure of its own rather than stretching
                                to whatever the trailing slot allows. */}
                            <TextField
                                aria-label="Display name"
                                className="w-56 max-w-full"
                                isDisabled={updateProfile.isPending}
                                isRequired
                                maxLength={80}
                                onBlur={() => {
                                    void saveDisplayName().catch(() => undefined);
                                }}
                                onChange={setDisplayName}
                                value={displayName}
                                variant="secondary"
                            >
                                <Input placeholder="Your name" />
                            </TextField>
                        </ItemCard.Action>
                    </ItemCard>
                </ItemCardGroup>
            </ItemCardGroup>
        </PageColumn>
    );
}
