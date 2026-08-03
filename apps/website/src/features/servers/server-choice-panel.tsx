import { Button, Form, Input, Label, Separator, TextField } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ServerSummary } from '../../lib/grotto-server.tsx';
import { CreateServerForm } from './create-server-form.tsx';
import { parseInvitationToken } from './server-choice.ts';
import { invitationRoute } from './server-routes.ts';
import { ServerSwitcher } from './server-switcher.tsx';

export function ServerChoicePanel({
    onServerSelect,
    servers,
}: {
    onServerSelect?: () => void;
    servers: ServerSummary[];
}) {
    return (
        <div className="flex flex-col gap-8">
            {servers.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <h2 className="font-medium text-muted text-sm">Joined Servers</h2>
                    <ServerSwitcher onSelect={onServerSelect} servers={servers} />
                </section>
            ) : null}
            <section className="flex flex-col gap-3">
                <div>
                    <h2 className="font-medium text-foreground text-sm">Create a Server</h2>
                    <p className="mt-0.5 text-muted text-xs">
                        Start a new place for your people and Agents.
                    </p>
                </div>
                <CreateServerForm onCreated={onServerSelect} />
            </section>
            <Separator />
            <section className="flex flex-col gap-3">
                <div>
                    <h2 className="font-medium text-foreground text-sm">Join a Server</h2>
                    <p className="mt-0.5 text-muted text-xs">Paste an invitation link or token.</p>
                </div>
                <JoinServerForm />
            </section>
        </div>
    );
}

function JoinServerForm() {
    const navigate = useNavigate();
    const [invitation, setInvitation] = React.useState('');
    const token = parseInvitationToken(invitation);

    return (
        <Form
            className="flex flex-col items-stretch gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (token) {
                    navigate(invitationRoute(token));
                }
            }}
        >
            <TextField fullWidth onChange={setInvitation} value={invitation} variant="secondary">
                <Label htmlFor="server-invitation">Invitation</Label>
                <Input
                    autoComplete="off"
                    id="server-invitation"
                    placeholder="https://app.grotto.com/invite/…"
                />
            </TextField>
            <div className="mt-1">
                <Button isDisabled={!token} type="submit" variant="secondary">
                    Continue
                </Button>
            </div>
        </Form>
    );
}
