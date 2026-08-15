import type { ServerMember } from '@tavern/api/membership';
import {
    useMember,
    useMemberAvatarUpdate,
    useMemberProfileUpdate,
    useMembers,
    useServerList,
} from '@tavern/app-client';
import { useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native/button';
import { ListGroup } from 'heroui-native/list-group';
import { Spinner } from 'heroui-native/spinner';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { KeyboardDismissArea } from '../../components/keyboard-dismiss-area.tsx';
import { SettingsSection } from '../../components/settings-section.tsx';
import { AppLayout } from '../mobile/app-layout.tsx';
import { BackHeader } from '../mobile/back-header.tsx';
import { EntityAvatar } from '../mobile/entity-avatar.tsx';
import { AvatarUploadButton } from './avatar-upload-button.tsx';
import { ProfileIdentityForm } from './profile-identity-form.tsx';

export function ProfileSettingsScreen() {
    const { server: serverParam } = useLocalSearchParams<{ server?: string | string[] }>();
    const servers = useServerList();
    const requestedServerId = singleParam(serverParam);
    const server =
        servers.data?.find((candidate) => candidate.id === requestedServerId) ?? servers.data?.[0];
    const members = useMembers(server?.id);
    const member = useMember(server?.id, members.data?.viewerUserId);

    if (servers.isError && !servers.data) {
        return (
            <ProfileState message="Grotto could not reach the Server." onRetry={servers.refetch} />
        );
    }
    if (servers.isPending || (server && members.isPending && !members.data)) {
        return <ProfileState />;
    }
    if (!(server && members.data?.viewerUserId)) {
        return <ProfileState message="Your profile is unavailable." />;
    }

    return (
        <AppLayout.Root>
            <BackHeader title="Profile" />
            <AppLayout.Content>
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
                    <ProfileSettingsContent member={member.data} serverId={server.id} />
                ) : (
                    <ProfileBodyState message="Your profile is unavailable." />
                )}
            </AppLayout.Content>
        </AppLayout.Root>
    );
}

function ProfileSettingsContent({ member, serverId }: { member: ServerMember; serverId: string }) {
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const avatar = useMemberAvatarUpdate(serverId, member.userId);
    const profile = useMemberProfileUpdate(serverId, member.userId);
    const displayName = member.displayName ?? member.email ?? 'You';

    return (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <KeyboardDismissArea className="gap-6 px-4 pt-3 pb-10">
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
                    descriptionHint="Shown on your Server profile."
                    displayName={displayName}
                    error={profile.error?.message ?? null}
                    isPending={profile.isPending}
                    key={`${member.displayName}:${member.description}`}
                    onSave={profile.save}
                />

                <SettingsSection title="Account">
                    <ListGroup>
                        <ProfileValue
                            label="Handle"
                            value={member.handle ? `@${member.handle}` : '—'}
                        />
                        <ProfileValue label="Email" value={member.email ?? 'Unavailable'} />
                        <ProfileValue label="Role" value={capitalize(member.role)} />
                        <ProfileValue label="Joined" value={formatDate(member.joinedAt)} />
                    </ListGroup>
                </SettingsSection>
            </KeyboardDismissArea>
        </ScrollView>
    );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
    return (
        <ListGroup.Item>
            <ListGroup.ItemContent>
                <ListGroup.ItemTitle>{label}</ListGroup.ItemTitle>
            </ListGroup.ItemContent>
            <ListGroup.ItemSuffix>
                <Text className="max-w-52 text-right text-base text-muted" numberOfLines={1}>
                    {value}
                </Text>
            </ListGroup.ItemSuffix>
        </ListGroup.Item>
    );
}

function ProfileState({ message, onRetry }: { message?: string; onRetry?: () => unknown }) {
    return (
        <AppLayout.Root>
            <BackHeader title="Profile" />
            <AppLayout.Content>
                {message ? (
                    <ProfileBodyState message={message} onRetry={onRetry} />
                ) : (
                    <ProfileBodyState />
                )}
            </AppLayout.Content>
        </AppLayout.Root>
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

function singleParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

function capitalize(value: string): string {
    return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
