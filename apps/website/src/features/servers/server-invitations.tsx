import { Button, Chip, Input, Label, TextField } from '@heroui/react';
import type { ServerInvitation } from '@tavern/api/hosted-membership';
import * as React from 'react';
import { CopyButton } from '../../components/copy-button.tsx';
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
                <div className="flex items-end gap-2">
                    <TextField
                        fullWidth
                        isInvalid={Boolean(create.error)}
                        onChange={setEmail}
                        type="email"
                        value={email}
                    >
                        <Label htmlFor="invite-email">Invite by Email</Label>
                        <Input
                            autoComplete="off"
                            id="invite-email"
                            placeholder="human@example.com"
                        />
                    </TextField>
                    <Button
                        isDisabled={create.isPending || email.trim().length === 0}
                        type="submit"
                    >
                        Invite
                    </Button>
                </div>
                <p className="text-muted text-xs">
                    They must accept while signed in to Clerk with this exact verified address.
                </p>
            </div>
            {create.error ? <p className="text-danger text-xs">{create.error.message}</p> : null}
            {issued ? (
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="text-foreground text-sm">
                        Send this link to {issued.invitation.email}. It is shown once.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-muted text-xs">
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
        return <p className="text-muted text-sm">No invitations yet.</p>;
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
                        <Chip
                            size="sm"
                            variant={invitation.status === 'pending' ? 'secondary' : 'soft'}
                        >
                            {invitation.status}
                        </Chip>
                    </div>
                    {invitation.status === 'pending' ? (
                        <Button
                            isDisabled={revoke.isPending}
                            onPress={() => revoke.mutate({ invitationId: invitation.id, serverId })}
                            size="sm"
                            variant="danger-soft"
                        >
                            Revoke
                        </Button>
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
