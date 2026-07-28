import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
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
                    <h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
                        Joined Servers
                    </h2>
                    <ServerSwitcher onSelect={onServerSelect} servers={servers} />
                </section>
            ) : null}
            <section className="flex flex-col gap-3">
                <div>
                    <h2 className="font-semibold text-foreground text-sm">Create a Server</h2>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                        Start a new place for your people and Agents.
                    </p>
                </div>
                <CreateServerForm />
            </section>
            <section className="flex flex-col gap-3 border-border border-t pt-6">
                <div>
                    <h2 className="font-semibold text-foreground text-sm">Join a Server</h2>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                        Paste an invitation link or token.
                    </p>
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
            onSubmit={(event) => {
                event.preventDefault();
                if (token) {
                    navigate(invitationRoute(token));
                }
            }}
        >
            <Field>
                <FieldLabel htmlFor="server-invitation">Invitation</FieldLabel>
                <Input
                    autoComplete="off"
                    id="server-invitation"
                    onChange={(event) => setInvitation(event.currentTarget.value)}
                    placeholder="https://app.grotto.com/invite/…"
                    value={invitation}
                />
            </Field>
            <Button className="self-start" disabled={!token} type="submit">
                Continue
            </Button>
        </Form>
    );
}
