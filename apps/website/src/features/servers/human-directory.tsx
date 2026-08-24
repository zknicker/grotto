import type { ServerMember, ServerMemberDirectory } from '@grotto/api/membership';
import { canManageServerInvitations } from '@grotto/api/membership';
import { Separator } from '@heroui/react';
import * as React from 'react';
import { useMembershipActions } from '../../hooks/servers/use-membership-actions.ts';
import { useServerInvitations } from '../../hooks/servers/use-server-invitations.ts';
import { SettingsGroup, SettingsItem, SettingsSection } from '../settings/layout/settings-page.tsx';
import { PageColumn } from '../shell/page-column.tsx';
import { InviteMemberForm, ServerInvitationList } from './server-invitations.tsx';
import { memberChangeDescription, type ServerMemberRowAction } from './server-member-actions.ts';
import {
    type PendingMemberChange,
    ServerMemberConfirmDialog,
} from './server-member-confirm-dialog.tsx';
import { ServerMemberList } from './server-member-list.tsx';

export function HumanDirectory({
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
    const commands = useMembershipActions(serverId);
    const [pending, setPending] = React.useState<PendingMemberChange | null>(null);

    if (!directory) {
        return (
            <div aria-busy="true" className="min-w-0 flex-1 overflow-y-auto">
                <span className="sr-only">Loading humans</span>
            </div>
        );
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
                <PageColumn>
                    <SettingsSection title={`Humans · ${directory.members.length}`}>
                        <SettingsGroup>
                            <ServerMemberList directory={directory} onChoose={openChange} />
                        </SettingsGroup>
                        {commandError ? (
                            <p className="px-1 text-danger text-sm">{commandError}</p>
                        ) : null}
                    </SettingsSection>
                    {canInvite ? (
                        <SettingsSection title="Invitations">
                            <SettingsGroup>
                                <SettingsItem>
                                    <InviteMemberForm serverId={serverId} />
                                </SettingsItem>
                                <Separator />
                                {!invitations.data && invitations.isPending ? (
                                    <div aria-busy="true" className="min-h-20">
                                        <span className="sr-only">Loading invitations</span>
                                    </div>
                                ) : invitations.error ? (
                                    <p className="px-5 py-3.5 text-danger text-sm" role="alert">
                                        {invitations.error.message}
                                    </p>
                                ) : (
                                    <ServerInvitationList
                                        invitations={invitations.data ?? []}
                                        serverId={serverId}
                                    />
                                )}
                            </SettingsGroup>
                        </SettingsSection>
                    ) : null}
                </PageColumn>
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
    commands: ReturnType<typeof useMembershipActions>,
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
