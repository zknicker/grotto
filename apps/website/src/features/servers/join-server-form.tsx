import { Button, Form, Input, Label, TextField } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { parseInvitationToken } from './server-choice.ts';
import { invitationRoute } from './server-routes.ts';

/** Accepts an invitation link or bare token and opens its invitation page. */
export function JoinServerForm() {
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
