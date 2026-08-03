import { Separator } from '@heroui/react';
import type { ServerMember, ServerMemberDirectory } from '@tavern/api/hosted-membership';
import { canManageServerInvitations } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { useServerInvitations } from '../../hooks/servers/use-server-invitations.ts';
import { useServerMembershipCommands } from '../../hooks/servers/use-server-membership-commands.ts';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsSection,
} from '../settings/layout/settings-page.tsx';
import { InviteMemberForm, ServerInvitationList } from './server-invitations.tsx';
import { memberChangeDescription, type ServerMemberRowAction } from './server-member-actions.ts';
import {
    type PendingMemberChange,
    ServerMemberConfirmDialog,
} from './server-member-confirm-dialog.tsx';
import { ServerMemberList } from './server-member-list.tsx';

export function HostedHumanDirectory({
    directory,
    serverId,
    serverSlug,
}: {
    directory: ServerMemberDirectory | undefined;
    serverId: string;
    serverSlug: string;
}) {
    const canInvite = directory ? canManageServerInvitations(directory.viewerRole) : false;
    const invitations = useServerInvitations(serverId, canInvite);
    const commands = useServerMembershipCommands(serverId);
    const [pending, setPending] = React.useState<PendingMemberChange | null>(null);

    if (!directory) {
        return null;
    }

    const openChange = (member: ServerMember, action: ServerMemberRowAction) =>
        setPending(
            buildPendingChange(member, action, serverSlug, commands, () => setPending(null))
        );

    const commandError =
        commands.changeRole.error?.message ??
        commands.remove.error?.message ??
        commands.leave.error?.message ??
        null;

    return (
        <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="px-5 py-6 sm:px-7">
                <SettingsPage>
                    <SettingsSection title={`Humans · ${directory.members.length}`}>
                        <SettingsGroup>
                            <ServerMemberList directory={directory} onChoose={openChange} />
                        </SettingsGroup>
                        {commandError ? (
                            <p className="px-1 text-danger text-xs">{commandError}</p>
                        ) : null}
                    </SettingsSection>
                    {canInvite ? (
                        <SettingsSection title="Invitations">
                            <SettingsGroup>
                                <SettingsItem>
                                    <InviteMemberForm serverId={serverId} />
                                </SettingsItem>
                                <Separator />
                                <ServerInvitationList
                                    invitations={invitations.data ?? []}
                                    serverId={serverId}
                                />
                            </SettingsGroup>
                        </SettingsSection>
                    ) : null}
                </SettingsPage>
            </div>
            <ServerMemberConfirmDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setPending(null);
                    }
                }}
                pending={pending}
                slug={serverSlug}
            />
        </div>
    );
}

function buildPendingChange(
    member: ServerMember,
    action: ServerMemberRowAction,
    slug: string,
    commands: ReturnType<typeof useServerMembershipCommands>,
    done: () => void
): PendingMemberChange {
    const serverId = commands.serverId ?? '';
    const shared = {
        description: memberChangeDescription(member, action, slug),
        label: action.label,
        requiresSlug: action.requiresSlug,
    };

    if (action.kind === 'leave') {
        return {
            ...shared,
            run: (confirmation) => {
                commands.leave.mutate({ confirmation, serverId });
                done();
            },
        };
    }

    if (action.kind === 'remove') {
        return {
            ...shared,
            run: (confirmation) => {
                commands.remove.mutate({ confirmation, serverId, userId: member.userId });
                done();
            },
        };
    }

    const nextRole = action.nextRole ?? member.role;

    return {
        ...shared,
        run: (confirmation) => {
            commands.changeRole.mutate({
                confirmation: action.requiresSlug ? confirmation : undefined,
                role: nextRole,
                serverId,
                userId: member.userId,
            });
            done();
        },
    };
}
