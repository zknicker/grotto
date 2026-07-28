import type { ServerMember, ServerMemberDirectory } from '@tavern/api/hosted-membership';
import { canManageServerInvitations } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { useServerInvitations } from '../../hooks/servers/use-server-invitations.ts';
import { useServerMembershipCommands } from '../../hooks/servers/use-server-membership-commands.ts';
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

    return (
        <div className="min-w-0 flex-1 overflow-y-auto">
            <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
                <header className="flex flex-col gap-1">
                    <h1 className="font-display text-2xl text-foreground">Members</h1>
                </header>
                <section className="flex flex-col gap-3">
                    <h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                        Humans
                    </h2>
                    <ServerMemberList directory={directory} onChoose={openChange} />
                    {commands.changeRole.error ? (
                        <p className="text-destructive text-xs">
                            {commands.changeRole.error.message}
                        </p>
                    ) : null}
                    {commands.remove.error ? (
                        <p className="text-destructive text-xs">{commands.remove.error.message}</p>
                    ) : null}
                    {commands.leave.error ? (
                        <p className="text-destructive text-xs">{commands.leave.error.message}</p>
                    ) : null}
                </section>
                {canInvite ? (
                    <section className="flex flex-col gap-4">
                        <h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                            Invitations
                        </h2>
                        <InviteMemberForm serverId={serverId} />
                        <ServerInvitationList
                            invitations={invitations.data ?? []}
                            serverId={serverId}
                        />
                    </section>
                ) : null}
                <ServerMemberConfirmDialog
                    onOpenChange={(open) => {
                        if (!open) {
                            setPending(null);
                        }
                    }}
                    pending={pending}
                    slug={serverSlug}
                />
            </main>
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
