import type { Agent } from '@grotto/api';
import * as React from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { useAgentAvatar } from '../../../hooks/members/use-agent-avatar.ts';
import { useAgentIdentity } from '../../../hooks/members/use-agent-identity.ts';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { MemberProfileHeader } from '../member-profile-header.tsx';
import { ProfileEdit } from '../profile-edit.tsx';
import { AgentAvatarGenerator } from './agent-avatar-generator.tsx';

export function AgentIdentity({
    agent,
    badges,
    canEdit,
    generationAvailable,
    serverId,
    trailing,
}: {
    agent: Agent;
    badges?: React.ReactNode;
    canEdit: boolean;
    /** Server-reported capability; without it the generate action never shows. */
    generationAvailable: boolean;
    serverId: string;
    trailing?: React.ReactNode;
}) {
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const [generateOpen, setGenerateOpen] = React.useState(false);
    const setAvatar = useAgentAvatar(serverId, agent.id);
    const updateIdentity = useAgentIdentity(serverId, agent.id);
    const error = avatarError ?? setAvatar.error?.message ?? updateIdentity.error?.message ?? null;
    // The menu always offers Generate for an ordinary Agent; without the
    // Server capability the item renders disabled with the reason inline.
    const canGenerate = canEdit && agent.factoryKind === 'ordinary';

    return (
        <MemberProfileHeader
            action={
                // Factory Agents (Cove) carry a product-owned identity the
                // Server refuses to change, so no pencil rather than a
                // guaranteed error.
                canEdit && agent.factoryKind === 'ordinary' ? (
                    <ProfileEdit
                        description={agent.description ?? ''}
                        displayName={agent.displayName}
                        entityLabel="Agent profile"
                        isDisabled={updateIdentity.isPending}
                        namePlaceholder="Agent name"
                        onSave={(draft) => updateIdentity.save(draft)}
                    />
                ) : null
            }
            avatar={
                canEdit ? (
                    <>
                        <AvatarPicker
                            generateUnavailableReason={
                                generationAvailable ? undefined : 'Not configured on this Server.'
                            }
                            isDisabled={setAvatar.isPending}
                            label="Agent photo"
                            name={agent.displayName}
                            onError={setAvatarError}
                            onGenerate={canGenerate ? () => setGenerateOpen(true) : undefined}
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
                        {canGenerate && generationAvailable ? (
                            <AgentAvatarGenerator
                                agentId={agent.id}
                                name={agent.displayName}
                                onOpenChange={setGenerateOpen}
                                open={generateOpen}
                                serverId={serverId}
                            />
                        ) : null}
                    </>
                ) : (
                    <EntityAvatar name={agent.displayName} size={64} src={agent.avatarUrl} />
                )
            }
            badges={badges}
            description={agent.description}
            name={agent.displayName}
            subtitle={`@${agent.handle}`}
            trailing={trailing}
        >
            {error ? <p className="text-danger text-sm">{error}</p> : null}
        </MemberProfileHeader>
    );
}
