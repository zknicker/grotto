import type { ServerMember, ServerMemberDirectory } from '@grotto/api/membership';
import { canManageServerInvitations } from '@grotto/api/membership';
import { Separator } from '@heroui/react';
import { ItemCard, ItemCardGroup } from '@heroui-pro/react';
import * as React from 'react';
import { useAgents } from '../../hooks/members/use-agents.ts';
import { useMembershipActions } from '../../hooks/servers/use-membership-actions.ts';
import { useServerInvitations } from '../../hooks/servers/use-server-invitations.ts';
import { SettingsPageHeader } from '../settings/layout/settings-page-header.tsx';
import { PageColumn } from '../shell/page-column.tsx';
import { ServerAgentList } from './server-agent-list.tsx';
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
            <div aria-busy="true" className="min-h-32">
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
        <>
            <PageColumn>
                <SettingsPageHeader
                    description="The people on this Server, their roles, and open invitations."
                    title="Members"
                />
                <AgentsSection serverId={serverId} serverSlug={serverSlug} />
                <ItemCardGroup variant="transparent">
                    <ItemCardGroup.Header>
                        <ItemCardGroup.Title>
                            Humans
                            <span className="ms-2 text-muted tabular-nums">
                                {directory.members.length}
                            </span>
                        </ItemCardGroup.Title>
                    </ItemCardGroup.Header>
                    <ItemCardGroup className="overflow-hidden">
                        <ServerMemberList
                            directory={directory}
                            onChoose={openChange}
                            serverSlug={serverSlug}
                        />
                    </ItemCardGroup>
                    {commandError ? (
                        <p className="px-4 text-danger text-sm">{commandError}</p>
                    ) : null}
                </ItemCardGroup>
                {canInvite ? (
                    <ItemCardGroup variant="transparent">
                        <ItemCardGroup.Header>
                            <ItemCardGroup.Title>Invitations</ItemCardGroup.Title>
                        </ItemCardGroup.Header>
                        <ItemCardGroup className="overflow-hidden">
                            <ItemCard>
                                <ItemCard.Content>
                                    <InviteMemberForm serverId={serverId} />
                                </ItemCard.Content>
                            </ItemCard>
                            <Separator />
                            {!invitations.data && invitations.isPending ? (
                                <div aria-busy="true" className="min-h-20">
                                    <span className="sr-only">Loading invitations</span>
                                </div>
                            ) : invitations.error ? (
                                <p className="px-4 py-3.5 text-danger text-sm" role="alert">
                                    {invitations.error.message}
                                </p>
                            ) : (
                                <ServerInvitationList
                                    invitations={invitations.data ?? []}
                                    serverId={serverId}
                                />
                            )}
                        </ItemCardGroup>
                    </ItemCardGroup>
                ) : null}
            </PageColumn>
            <ServerMemberConfirmDialog
                onOpenChange={(open) => {
                    if (!open) {
                        setPending(null);
                    }
                }}
                pending={pending}
                slug={serverSlug}
            />
        </>
    );
}

/**
 * Agents come from their own query rather than the member directory, because
 * their membership lives on the agent record. Blank while loading — the app
 * shows no skeletons on synced surfaces.
 */
function AgentsSection({ serverId, serverSlug }: { serverId: string; serverSlug: string }) {
    const agents = useAgents(serverId);
    const items = agents.data ?? [];

    if (!agents.data) {
        return (
            <div aria-busy="true" className="min-h-24">
                <span className="sr-only">Loading Agents</span>
            </div>
        );
    }

    return (
        <ItemCardGroup variant="transparent">
            <ItemCardGroup.Header>
                <ItemCardGroup.Title>
                    Agents
                    <span className="ms-2 text-muted tabular-nums">{items.length}</span>
                </ItemCardGroup.Title>
            </ItemCardGroup.Header>
            <ItemCardGroup className="overflow-hidden">
                {items.length === 0 ? (
                    <ItemCard>
                        <ItemCard.Content>
                            <ItemCard.Description>
                                No Agents on this Server yet.
                            </ItemCard.Description>
                        </ItemCard.Content>
                    </ItemCard>
                ) : (
                    <ServerAgentList agents={items} serverSlug={serverSlug} />
                )}
            </ItemCardGroup>
        </ItemCardGroup>
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
