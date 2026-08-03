import { Chip, Separator } from '@heroui/react';
import type { HostedAgent } from '@tavern/api';
import type { ServerMember } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { StatusDot } from '../../../components/ui/status-dot.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';
import { withSavingToast } from '../../../lib/saving-toast.ts';
import { AvatarPicker } from '../../avatars/avatar-picker.tsx';
import { humanDisplayName, humanHandle } from '../../servers/human-identity.ts';
import { serverMembersRoute } from '../../servers/server-routes.ts';
import { InlineEditField } from '../../settings/layout/inline-edit-field.tsx';
import {
    SettingsChipField,
    SettingsChipRow,
    SettingsGroup,
    SettingsPage,
    SettingsRow,
    SettingsSection,
} from '../../settings/layout/settings-page.tsx';
import { hostedAvailabilityStatus } from '../hosted-agent-avatar.tsx';

/**
 * One human's profile, shaped like an Agent's: identity header, the fields
 * they own, the facts the Server knows, and the Agents they created. Only the
 * viewer's own profile is editable — the Server judges that too.
 */
export function HostedHumanProfile({
    member,
    server,
    viewerUserId,
}: {
    member: ServerMember;
    server: ServerDetail;
    viewerUserId: string;
}) {
    const utils = grottoTrpc.useUtils();
    const agents = grottoTrpc.agent.list.useQuery({ serverId: server.id });
    const [avatarError, setAvatarError] = React.useState<string | null>(null);
    const isSelf = member.userId === viewerUserId;
    const name = humanDisplayName(member);
    const handle = humanHandle(member);
    const invalidate = () => utils.member.list.invalidate({ serverId: server.id });
    const setAvatar = grottoTrpc.avatar.set.useMutation({ onSuccess: invalidate });
    const updateProfile = grottoTrpc.member.updateProfile.useMutation({ onSuccess: invalidate });
    const created = (agents.data ?? []).filter((agent) => agent.createdByUserId === member.userId);

    const saveProfile = async (next: { description: string; displayName: string }) => {
        await withSavingToast(() =>
            updateProfile.mutateAsync({
                description: next.description.trim() || null,
                displayName: next.displayName.trim(),
            })
        );
    };

    return (
        <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="px-5 py-6 sm:px-7">
                <div className="mb-8 flex min-w-0 items-center gap-4">
                    <EntityAvatar name={name} size="lg" src={member.avatarUrl} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h1 className="min-w-0 truncate font-semibold text-foreground text-xl">
                            {name}
                        </h1>
                        <p className="truncate text-muted text-sm">
                            {handle ?? member.userId}
                            {isSelf ? ' (you)' : ''}
                        </p>
                    </div>
                </div>
                <SettingsPage>
                    <SettingsSection title="Profile">
                        <SettingsGroup>
                            <SettingsRow
                                description="Shown beside your messages."
                                error={avatarError ?? setAvatar.error?.message ?? null}
                                title="Photo"
                                trailingWidth="intrinsic"
                            >
                                <div className="flex items-center md:justify-end">
                                    <AvatarPicker
                                        isDisabled={!isSelf || setAvatar.isPending}
                                        label="profile photo"
                                        name={name}
                                        onError={setAvatarError}
                                        onSelect={async (image) => {
                                            await setAvatar.mutateAsync({
                                                bytesBase64: image.base64,
                                                mediaType: image.mediaType,
                                                serverId: server.id,
                                                target: { kind: 'user' },
                                            });
                                        }}
                                        src={member.avatarUrl}
                                    />
                                </div>
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Name">
                                {isSelf ? (
                                    <InlineEditField
                                        ariaLabel="Your display name"
                                        isDisabled={updateProfile.isPending}
                                        isRequired
                                        maxLength={80}
                                        onCommit={(displayName) =>
                                            saveProfile({
                                                description: member.description ?? '',
                                                displayName,
                                            })
                                        }
                                        placeholder="Your name"
                                        value={member.displayName ?? ''}
                                    />
                                ) : (
                                    <span className="text-muted text-sm md:text-right">{name}</span>
                                )}
                            </SettingsRow>
                            <Separator />
                            <SettingsRow title="Description" trailingWidth="wide">
                                {isSelf ? (
                                    <InlineEditField
                                        ariaLabel="Your description"
                                        isDisabled={updateProfile.isPending}
                                        maxLength={500}
                                        multiline
                                        onCommit={(description) =>
                                            saveProfile({
                                                description,
                                                displayName: member.displayName ?? name,
                                            })
                                        }
                                        placeholder="No description yet."
                                        value={member.description ?? ''}
                                    />
                                ) : (
                                    <span className="text-muted text-sm md:text-right">
                                        {member.description ?? 'No description yet.'}
                                    </span>
                                )}
                            </SettingsRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <SettingsSection title="Info">
                        <SettingsGroup>
                            <SettingsChipRow>
                                <SettingsChipField
                                    label="Role"
                                    value={<span className="capitalize">{member.role}</span>}
                                />
                                {member.email ? (
                                    <SettingsChipField label="Email" value={member.email} />
                                ) : null}
                                <SettingsChipField
                                    label="Joined"
                                    value={new Date(member.joinedAt).toLocaleDateString(undefined, {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                />
                            </SettingsChipRow>
                        </SettingsGroup>
                    </SettingsSection>

                    <SettingsSection
                        action={
                            <Chip size="sm" variant="soft">
                                <Chip.Label>{created.length}</Chip.Label>
                            </Chip>
                        }
                        title="Created Agents"
                    >
                        {created.length === 0 ? (
                            <p className="px-1 text-muted text-sm">
                                No Agents created by this human yet.
                            </p>
                        ) : (
                            <SettingsGroup>
                                {created.map((agent, index) => (
                                    <React.Fragment key={agent.id}>
                                        {index > 0 ? <Separator /> : null}
                                        <CreatedAgentRow agent={agent} slug={server.slug} />
                                    </React.Fragment>
                                ))}
                            </SettingsGroup>
                        )}
                    </SettingsSection>
                </SettingsPage>
            </div>
        </div>
    );
}

function CreatedAgentRow({ agent, slug }: { agent: HostedAgent; slug: string }) {
    const navigate = useNavigate();

    return (
        <button
            className="flex w-full cursor-[var(--cursor-interactive)] items-center gap-3 px-5 py-3.5 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => navigate(`${serverMembersRoute(slug)}/agents/${agent.id}`)}
            type="button"
        >
            <EntityAvatar name={agent.displayName} size="sm" src={agent.avatarUrl} />
            <span className="min-w-0 truncate font-medium text-foreground text-sm">
                {agent.displayName}
            </span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted text-xs">
                <StatusDot status={hostedAvailabilityStatus(agent.availability)} />
                <span className="capitalize">{agent.availability}</span>
            </span>
        </button>
    );
}
