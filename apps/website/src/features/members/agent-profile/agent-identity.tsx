import type { Agent } from '@grotto/api';
import * as React from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { useAgentAvatar } from '../../../hooks/members/use-agent-avatar.ts';
import { useAgentIdentity } from '../../../hooks/members/use-agent-identity.ts';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { MemberProfileHeader } from '../member-profile-header.tsx';
import { ProfileEdit } from '../profile-edit.tsx';

export function AgentIdentity({
    agent,
    canEdit,
    children,
    serverId,
    status,
}: {
    agent: Agent;
    canEdit: boolean;
    children: React.ReactNode;
    serverId: string;
    status: React.ReactNode;
}) {
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const setAvatar = useAgentAvatar(serverId, agent.id);
    const updateIdentity = useAgentIdentity(serverId, agent.id);
    const error = avatarError ?? setAvatar.error?.message ?? updateIdentity.error?.message ?? null;

    return (
        <MemberProfileHeader
            avatar={
                canEdit ? (
                    <AvatarPicker
                        isDisabled={setAvatar.isPending}
                        label="Agent photo"
                        name={agent.displayName}
                        onError={setAvatarError}
                        onSelect={async (image) => {
                            await setAvatar.mutateAsync({
                                bytesBase64: image.base64,
                                mediaType: image.mediaType,
                                serverId,
                                target: { agentId: agent.id, kind: 'agent' },
                            });
                        }}
                        size={64}
                        src={agent.avatarUrl}
                    />
                ) : (
                    <EntityAvatar name={agent.displayName} size={64} src={agent.avatarUrl} />
                )
            }
            description={agent.description ?? 'No description yet.'}
            descriptionAction={
                canEdit ? (
                    <ProfileEdit
                        ariaLabel="Agent description"
                        isDisabled={updateIdentity.isPending}
                        maxLength={500}
                        multiline
                        onSave={(description) =>
                            updateIdentity.save({
                                description,
                                displayName: agent.displayName,
                            })
                        }
                        placeholder="No description yet."
                        value={agent.description ?? ''}
                    />
                ) : null
            }
            name={agent.displayName}
            nameAction={
                canEdit ? (
                    <ProfileEdit
                        ariaLabel="Agent name"
                        isDisabled={updateIdentity.isPending}
                        isRequired
                        maxLength={80}
                        onSave={(displayName) =>
                            updateIdentity.save({
                                description: agent.description ?? '',
                                displayName,
                            })
                        }
                        placeholder="Agent name"
                        value={agent.displayName}
                    />
                ) : null
            }
            status={status}
            subtitle={`@${agent.handle}`}
        >
            {error ? <p className="mb-3 text-danger text-sm">{error}</p> : null}
            {children}
        </MemberProfileHeader>
    );
}
