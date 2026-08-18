import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    AtIcon,
    Calendar03Icon,
    IdentityCardIcon,
    Mail01Icon,
} from '@hugeicons-pro/core-stroke-rounded';
import type { ServerMember } from '@tavern/api/membership';
import {
    useMember,
    useMemberAvatarUpdate,
    useMemberProfileUpdate,
    useMembers,
} from '@tavern/app-client';
import { Button } from 'heroui-native/button';
import { Spinner } from 'heroui-native/spinner';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardDismissArea } from '../../components/keyboard-dismiss-area.tsx';
import { SettingsListGroup } from '../../components/settings-list-group.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { SettingsValueRow } from '../../components/settings-value-row.tsx';
import { EntityAvatar } from '../mobile/entity-avatar.tsx';
import { AvatarUploadButton } from './avatar-upload-button.tsx';
import { ProfileIdentityForm } from './profile-identity-form.tsx';
import { SettingsBackHeader } from './settings-screen-header.tsx';

export function ProfileSettingsScreen({
    onBack,
    onEditDescription,
    serverId,
}: {
    onBack: () => void;
    onEditDescription: (profile: {
        description: string;
        displayName: string;
        memberId: string;
    }) => void;
    serverId: string;
}) {
    const members = useMembers(serverId);
    const member = useMember(serverId, members.data?.viewerUserId);

    if (members.isPending && !members.data) {
        return <ProfileState onBack={onBack} />;
    }
    if (!members.data?.viewerUserId) {
        return <ProfileState message="Your profile is unavailable." onBack={onBack} />;
    }

    return (
        <View className="flex-1">
            <SettingsBackHeader onBack={onBack} title="Profile" />
            {member.isPending && !member.data ? (
                <View className="flex-1 items-center justify-center">
                    <Spinner />
                </View>
            ) : member.isError && !member.data ? (
                <ProfileBodyState
                    message="Your profile could not be loaded."
                    onRetry={member.refetch}
                />
            ) : member.data ? (
                <ProfileSettingsContent
                    member={member.data}
                    onEditDescription={onEditDescription}
                    serverId={serverId}
                />
            ) : (
                <ProfileBodyState message="Your profile is unavailable." />
            )}
        </View>
    );
}

function ProfileSettingsContent({
    member,
    onEditDescription,
    serverId,
}: {
    member: ServerMember;
    onEditDescription: (profile: {
        description: string;
        displayName: string;
        memberId: string;
    }) => void;
    serverId: string;
}) {
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const avatar = useMemberAvatarUpdate(serverId, member.userId);
    const profile = useMemberProfileUpdate(serverId, member.userId);
    const displayName = member.displayName ?? member.email ?? 'You';

    return (
        <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <KeyboardDismissArea className="gap-6 px-4 pt-3 pb-safe-offset-3">
                <View className="items-center gap-3 py-2">
                    <EntityAvatar avatarUrl={member.avatarUrl} name={displayName} size={80} />
                    <View className="items-center gap-0.5">
                        <Text className="font-semibold text-foreground text-xl">{displayName}</Text>
                        {member.handle ? (
                            <Text className="text-muted text-sm">@{member.handle}</Text>
                        ) : null}
                    </View>
                    <AvatarUploadButton
                        isPending={avatar.isPending}
                        label="Change profile photo"
                        onError={setAvatarError}
                        onSelect={async (image) => {
                            await avatar.mutateAsync({
                                ...image,
                                serverId,
                                target: { kind: 'user' },
                            });
                        }}
                    />
                    {(avatarError ?? avatar.error?.message) ? (
                        <Text className="text-center text-danger text-sm">
                            {avatarError ?? avatar.error?.message}
                        </Text>
                    ) : null}
                </View>

                <ProfileIdentityForm
                    description={member.description ?? ''}
                    displayName={displayName}
                    error={profile.error?.message ?? null}
                    isPending={profile.isPending}
                    onEditDescription={() =>
                        onEditDescription({
                            description: member.description ?? '',
                            displayName,
                            memberId: member.userId,
                        })
                    }
                    onSave={profile.save}
                />

                <SettingsSection title="Account">
                    <SettingsListGroup>
                        <SettingsValueRow
                            icon={AtIcon}
                            label="Handle"
                            value={member.handle ? `@${member.handle}` : '—'}
                        />
                        <SettingsValueRow
                            icon={Mail01Icon}
                            label="Email"
                            value={member.email ?? 'Unavailable'}
                        />
                        <SettingsValueRow
                            icon={IdentityCardIcon}
                            label="Role"
                            value={capitalize(member.role)}
                        />
                        <SettingsValueRow
                            icon={Calendar03Icon}
                            label="Joined"
                            value={formatDate(member.joinedAt)}
                        />
                    </SettingsListGroup>
                </SettingsSection>
            </KeyboardDismissArea>
        </BottomSheetScrollView>
    );
}

function ProfileState({
    message,
    onBack,
    onRetry,
}: {
    message?: string;
    onBack: () => void;
    onRetry?: () => unknown;
}) {
    return (
        <View className="flex-1">
            <SettingsBackHeader onBack={onBack} title="Profile" />
            {message ? (
                <ProfileBodyState message={message} onRetry={onRetry} />
            ) : (
                <ProfileBodyState />
            )}
        </View>
    );
}

function ProfileBodyState({ message, onRetry }: { message?: string; onRetry?: () => unknown }) {
    return (
        <View className="flex-1 items-center justify-center gap-4 px-8">
            {message ? (
                <Text className="text-center text-base text-muted">{message}</Text>
            ) : (
                <Spinner />
            )}
            {onRetry ? <Button onPress={() => void onRetry()}>Try again</Button> : null}
        </View>
    );
}

function capitalize(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
