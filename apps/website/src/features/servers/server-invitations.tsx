import type { ServerInvitation } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { Badge } from '../../components/ui/badge.tsx';
import { CopyButton } from '../../components/ui/copy-button.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Label } from '../../components/ui/primitives/label.tsx';
import { useServerInvitationCommands } from '../../hooks/servers/use-server-invitations.ts';
import { invitationLink } from './server-routes.ts';

/**
 * Issuing an invitation and handing over its link. Grotto sends no email: the
 * Server discloses the raw token once, here, and the Owner or Admin passes it
 * on however they choose. Losing it means revoking and reissuing.
 */
export function InviteMemberForm({ serverId }: { serverId: string }) {
    const [email, setEmail] = React.useState('');
    const { create } = useServerInvitationCommands();
    const issued = create.data;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                create.mutate({ email, serverId }, { onSuccess: () => setEmail('') });
            }}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">Invite by email</Label>
                <div className="flex items-center gap-2">
                    <Input
                        autoComplete="off"
                        id="invite-email"
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="human@example.com"
                        type="email"
                        value={email}
                    />
                    <Button disabled={create.isPending || email.trim().length === 0} type="submit">
                        Invite
                    </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                    They must accept while signed in to Clerk with this exact verified address.
                </p>
            </div>
            {create.error ? (
                <p className="text-destructive text-xs">{create.error.message}</p>
            ) : null}
            {issued ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-foreground text-sm">
                        Send this link to {issued.invitation.email}. It is shown once.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                            {invitationLink(issued.token)}
                        </code>
                        <CopyButton value={invitationLink(issued.token)} />
                    </div>
                </div>
            ) : null}
        </form>
    );
}

/** Invitations issued on this Server, with revocation for the live ones. */
export function ServerInvitationList({
    invitations,
    serverId,
}: {
    invitations: ServerInvitation[];
    serverId: string;
}) {
    const { revoke } = useServerInvitationCommands();

    if (invitations.length === 0) {
        return <p className="text-muted-foreground text-sm">No invitations yet.</p>;
    }

    return (
        <ul className="flex flex-col gap-1">
            {invitations.map((invitation) => (
                <li
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
                    data-invitation-id={invitation.id}
                    key={invitation.id}
                >
                    <div className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-foreground text-sm">{invitation.email}</span>
                        <Badge variant={invitation.status === 'pending' ? 'secondary' : 'subtle'}>
                            {invitation.status}
                        </Badge>
                    </div>
                    {invitation.status === 'pending' ? (
                        <Button
                            disabled={revoke.isPending}
                            onClick={() => revoke.mutate({ invitationId: invitation.id, serverId })}
                            size="xs"
                            variant="ghost"
                        >
                            Revoke
                        </Button>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
