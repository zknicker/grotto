import type { RuntimeInvite, RuntimeMember, RuntimeUser } from '@tavern/api';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Separator } from '../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsItem,
    SettingsPage,
    SettingsPageHeader,
    SettingsSection,
} from '../../components/ui/settings-row.tsx';
import { useCurrentUser } from '../../hooks/identity/use-current-user.ts';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { withSavingToast } from '../../lib/saving-toast.ts';
import { trpc } from '../../lib/trpc.tsx';

export function MembersAdmin() {
    if (!isClerkEnabled) {
        return (
            <SettingsPage>
                <SettingsPageHeader title="Members" />
                <SettingsGroup>
                    <SettingsItem className="text-muted-foreground text-sm">
                        Members are available when Grotto sign-in is enabled.
                    </SettingsItem>
                </SettingsGroup>
            </SettingsPage>
        );
    }

    return <SignedInMembersAdmin />;
}

function SignedInMembersAdmin() {
    const utils = trpc.useUtils();
    const { role } = useCurrentUser();
    const isOwner = role === 'owner';
    const members = trpc.identity.members.useQuery();
    const invites = trpc.identity.invites.useQuery(undefined, { enabled: isOwner });
    const [newInvite, setNewInvite] = React.useState<RuntimeInvite | null>(null);
    const createInvite = trpc.identity.createInvite.useMutation({
        onSuccess: async ({ invite }) => {
            setNewInvite(invite);
            await utils.identity.invites.invalidate();
        },
    });
    const revokeInvite = trpc.identity.revokeInvite.useMutation({
        onSuccess: async () => await utils.identity.invites.invalidate(),
    });
    const removeMember = trpc.identity.removeMember.useMutation({
        onSuccess: async () => await utils.identity.members.invalidate(),
    });
    const listedInvites = (invites.data?.invites ?? []).filter(
        (invite) => invite.id !== newInvite?.id
    );

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="People who can join this Grotto and chat with its agents."
                title="Members"
            />
            <SettingsSection title="Members">
                <SettingsGroup>
                    <MemberList
                        isOwner={isOwner}
                        members={members.data?.members ?? []}
                        onRemove={(userId) =>
                            void withSavingToast(() => removeMember.mutateAsync({ userId })).catch(
                                () => undefined
                            )
                        }
                        pendingUserId={removeMember.variables?.userId ?? null}
                        status={members.isPending ? 'loading' : members.error ? 'error' : 'ready'}
                    />
                </SettingsGroup>
            </SettingsSection>
            {isOwner ? (
                <SettingsSection
                    action={
                        <Button
                            loading={createInvite.isPending}
                            onClick={() =>
                                void withSavingToast(() => createInvite.mutateAsync()).catch(
                                    () => undefined
                                )
                            }
                            size="sm"
                            type="button"
                        >
                            Create invite
                        </Button>
                    }
                    title="Invites"
                >
                    <SettingsGroup>
                        {newInvite ? <NewInvite invite={newInvite} /> : null}
                        {newInvite && listedInvites.length > 0 ? <Separator /> : null}
                        <InviteList
                            hasNewInvite={newInvite !== null}
                            invites={listedInvites}
                            onRevoke={(id) =>
                                void withSavingToast(() => revokeInvite.mutateAsync({ id })).catch(
                                    () => undefined
                                )
                            }
                            pendingInviteId={revokeInvite.variables?.id ?? null}
                            status={
                                invites.isPending ? 'loading' : invites.error ? 'error' : 'ready'
                            }
                        />
                    </SettingsGroup>
                </SettingsSection>
            ) : null}
        </SettingsPage>
    );
}

function MemberList({
    isOwner,
    members,
    onRemove,
    pendingUserId,
    status,
}: {
    isOwner: boolean;
    members: RuntimeMember[];
    onRemove: (userId: string) => void;
    pendingUserId: string | null;
    status: 'error' | 'loading' | 'ready';
}) {
    if (status !== 'ready') {
        return <StatusItem status={status} subject="members" />;
    }

    return members.map((member, index) => (
        <React.Fragment key={member.user.id}>
            {index > 0 ? <Separator /> : null}
            <SettingsItem className="flex items-center gap-3">
                <MemberAvatar user={member.user} />
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-sm">
                            {displayName(member.user)}
                        </span>
                        <Badge variant={member.role === 'owner' ? 'default' : 'subtle'}>
                            {member.role}
                        </Badge>
                    </div>
                    {member.user.email && member.user.email !== displayName(member.user) ? (
                        <p className="truncate text-muted-foreground text-xs">
                            {member.user.email}
                        </p>
                    ) : null}
                </div>
                {isOwner && member.role !== 'owner' ? (
                    <Button
                        loading={pendingUserId === member.user.id}
                        onClick={() => onRemove(member.user.id)}
                        size="sm"
                        type="button"
                        variant="destructive"
                    >
                        Remove
                    </Button>
                ) : null}
            </SettingsItem>
        </React.Fragment>
    ));
}

function MemberAvatar({ user }: { user: RuntimeUser }) {
    const name = displayName(user);
    return (
        <Avatar>
            {user.avatarUrl ? <AvatarImage alt={`${name} avatar`} src={user.avatarUrl} /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
    );
}

function NewInvite({ invite }: { invite: RuntimeInvite }) {
    return (
        <SettingsItem className="flex items-center gap-3 bg-muted">
            <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">New invite code</p>
                <code className="block truncate font-mono text-muted-foreground text-xs">
                    {invite.code}
                </code>
            </div>
            <CopyButton label="Copy invite code" value={invite.code} />
        </SettingsItem>
    );
}

function InviteList({
    hasNewInvite,
    invites,
    onRevoke,
    pendingInviteId,
    status,
}: {
    hasNewInvite: boolean;
    invites: RuntimeInvite[];
    onRevoke: (id: string) => void;
    pendingInviteId: string | null;
    status: 'error' | 'loading' | 'ready';
}) {
    if (status !== 'ready') {
        return <StatusItem status={status} subject="invites" />;
    }
    if (invites.length === 0) {
        // The freshly created invite renders in its own callout above.
        if (hasNewInvite) {
            return null;
        }
        return (
            <SettingsItem className="text-muted-foreground text-sm">No invites yet.</SettingsItem>
        );
    }

    return invites.map((invite, index) => {
        const redeemed = invite.redeemedAt !== null;
        return (
            <React.Fragment key={invite.id}>
                {index > 0 ? <Separator /> : null}
                <SettingsItem
                    className={
                        redeemed ? 'flex items-center gap-3 opacity-60' : 'flex items-center gap-3'
                    }
                >
                    <code className="min-w-0 flex-1 truncate font-mono text-sm">{invite.code}</code>
                    {redeemed ? (
                        <Badge variant="subtle">Redeemed</Badge>
                    ) : (
                        <>
                            <CopyButton label="Copy invite code" value={invite.code} />
                            <Button
                                loading={pendingInviteId === invite.id}
                                onClick={() => onRevoke(invite.id)}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                Revoke
                            </Button>
                        </>
                    )}
                </SettingsItem>
            </React.Fragment>
        );
    });
}

function StatusItem({ status, subject }: { status: 'error' | 'loading'; subject: string }) {
    return (
        <SettingsItem className="text-muted-foreground text-sm">
            {status === 'loading' ? `Loading ${subject}…` : `Could not load ${subject}.`}
        </SettingsItem>
    );
}

function displayName(user: RuntimeUser) {
    return user.name ?? user.email ?? user.id;
}

function initials(value: string) {
    const parts = value.trim().split(/\s+/u);
    return parts.length > 1
        ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
        : value.slice(0, 2).toUpperCase();
}
