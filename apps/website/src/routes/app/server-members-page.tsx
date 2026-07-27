import type { ServerMember } from '@tavern/api/hosted-membership';
import { canManageServerInvitations } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    InviteMemberForm,
    ServerInvitationList,
} from '../../features/servers/server-invitations.tsx';
import {
    memberChangeDescription,
    type ServerMemberRowAction,
} from '../../features/servers/server-member-actions.ts';
import {
    type PendingMemberChange,
    ServerMemberConfirmDialog,
} from '../../features/servers/server-member-confirm-dialog.tsx';
import { ServerMemberList } from '../../features/servers/server-member-list.tsx';
import { serverRoute } from '../../features/servers/server-routes.ts';
import { useServer } from '../../hooks/servers/use-server.ts';
import { useServerInvitations } from '../../hooks/servers/use-server-invitations.ts';
import { useServerMembers } from '../../hooks/servers/use-server-members.ts';
import { useServerMembershipCommands } from '../../hooks/servers/use-server-membership-commands.ts';

/** Invitation and membership management for one Grotto server. */
export function ServerMembersPage() {
    const { slug = '' } = useParams();
    const server = useServer(slug);
    const serverId = server.data?.id;
    const directory = useServerMembers(serverId);
    const canInvite = directory.data
        ? canManageServerInvitations(directory.data.viewerRole)
        : false;
    const invitations = useServerInvitations(serverId, canInvite);
    const commands = useServerMembershipCommands(serverId);
    const [pending, setPending] = React.useState<PendingMemberChange | null>(null);

    if (server.error) {
        return <MembersMessage detail={server.error.message} title="Server unavailable" />;
    }

    if (!(server.data && directory.data)) {
        return null;
    }

    const openChange = (member: ServerMember, action: ServerMemberRowAction) =>
        setPending(
            buildPendingChange(member, action, server.data.slug, commands, () => setPending(null))
        );

    return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
            <header className="flex flex-col gap-1">
                <Link
                    className="text-muted-foreground text-xs hover:text-foreground"
                    to={serverRoute(server.data.slug)}
                >
                    ← {server.data.displayName}
                </Link>
                <h1 className="font-display text-2xl text-foreground">Members</h1>
            </header>

            <section className="flex flex-col gap-3">
                <h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                    Humans
                </h2>
                <ServerMemberList directory={directory.data} onChoose={openChange} />
                {commands.changeRole.error ? (
                    <p className="text-destructive text-xs">{commands.changeRole.error.message}</p>
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
                    <InviteMemberForm serverId={server.data.id} />
                    <ServerInvitationList
                        invitations={invitations.data ?? []}
                        serverId={server.data.id}
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
                slug={server.data.slug}
            />
        </main>
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

function MembersMessage({ detail, title }: { detail: string; title: string }) {
    return (
        <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
            <h1 className="font-semibold text-foreground text-lg">{title}</h1>
            <p className="max-w-sm text-muted-foreground text-sm">{detail}</p>
        </main>
    );
}
