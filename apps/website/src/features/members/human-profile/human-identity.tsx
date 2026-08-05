import { Chip } from '@heroui/react';
import { ShieldUserIcon } from '@hugeicons-pro/core-stroke-rounded';
import type { ServerMember } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { useHumanAvatar } from '../../../hooks/members/use-human-avatar.ts';
import { useHumanIdentity } from '../../../hooks/members/use-human-identity.ts';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { humanDisplayName, humanHandle } from '../../servers/human-identity.ts';
import {
    MemberProfileFact,
    MemberProfileFacts,
    MemberProfileHeader,
} from '../member-profile-header.tsx';
import { ProfileEdit } from '../profile-edit.tsx';

/** Human-owned identity, edits, and durable Server facts. */
export function HumanIdentity({
    isSelf,
    member,
    serverId,
}: {
    isSelf: boolean;
    member: ServerMember;
    serverId: string;
}) {
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const name = humanDisplayName(member);
    const handle = humanHandle(member);
    const setAvatar = useHumanAvatar(serverId, member.userId);
    const updateProfile = useHumanIdentity(serverId, member.userId);
    const error = avatarError ?? setAvatar.error?.message ?? updateProfile.error?.message ?? null;

    return (
        <MemberProfileHeader
            avatar={
                isSelf ? (
                    <AvatarPicker
                        isDisabled={setAvatar.isPending}
                        label="profile photo"
                        name={name}
                        onError={setAvatarError}
                        onSelect={async (image) => {
                            await setAvatar.mutateAsync({
                                bytesBase64: image.base64,
                                mediaType: image.mediaType,
                                serverId,
                                target: { kind: 'user' },
                            });
                        }}
                        size={64}
                        src={member.avatarUrl}
                    />
                ) : (
                    <EntityAvatar name={name} size={64} src={member.avatarUrl} />
                )
            }
            description={member.description ?? 'No description yet.'}
            descriptionAction={
                isSelf ? (
                    <ProfileEdit
                        ariaLabel="Your description"
                        isDisabled={updateProfile.isPending}
                        maxLength={500}
                        multiline
                        onSave={(description) =>
                            updateProfile.save({
                                description,
                                displayName: member.displayName ?? name,
                            })
                        }
                        placeholder="No description yet."
                        value={member.description ?? ''}
                    />
                ) : null
            }
            name={name}
            nameAction={
                isSelf ? (
                    <ProfileEdit
                        ariaLabel="Your display name"
                        isDisabled={updateProfile.isPending}
                        isRequired
                        maxLength={80}
                        onSave={(displayName) =>
                            updateProfile.save({
                                description: member.description ?? '',
                                displayName,
                            })
                        }
                        placeholder="Your name"
                        value={member.displayName ?? ''}
                    />
                ) : null
            }
            subtitle={
                <>
                    {handle ?? member.userId}
                    {isSelf ? ' (you)' : ''}
                </>
            }
        >
            {error ? <p className="mb-3 text-danger text-sm">{error}</p> : null}
            <MemberProfileFacts>
                <MemberProfileFact
                    label="Role"
                    value={
                        <Chip
                            color={member.role === 'member' ? 'default' : 'accent'}
                            variant="primary"
                        >
                            <Icon className="size-4 shrink-0" icon={ShieldUserIcon} />
                            <Chip.Label className="capitalize">{member.role}</Chip.Label>
                        </Chip>
                    }
                />
                <MemberProfileFact label="Email" value={member.email ?? 'Unavailable'} />
                <MemberProfileFact
                    className="tabular-nums"
                    label="Joined"
                    value={new Date(member.joinedAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    })}
                />
            </MemberProfileFacts>
        </MemberProfileHeader>
    );
}
