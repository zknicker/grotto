import { Button, Form, Input, Label, TextField } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { parseInvitationToken } from './server-choice.ts';
import { invitationRoute } from './server-routes.ts';

export interface JoinServerFormState {
    invitation: string;
    isSubmittable: boolean;
    setInvitation: (invitation: string) => void;
    submit: () => void;
}

/** Owns the invitation field and parsing so any layout can compose them. */
export function useJoinServerForm(): JoinServerFormState {
    const navigate = useNavigate();
    const [invitation, setInvitation] = React.useState('');
    const token = parseInvitationToken(invitation);

    return {
        invitation,
        isSubmittable: Boolean(token),
        setInvitation,
        submit: () => {
            if (token) {
                navigate(invitationRoute(token));
            }
        },
    };
}

export function JoinServerFields({ form }: { form: JoinServerFormState }) {
    return (
        <TextField
            fullWidth
            onChange={form.setInvitation}
            value={form.invitation}
            variant="secondary"
        >
            <Label htmlFor="server-invitation">Invitation</Label>
            <Input
                autoComplete="off"
                id="server-invitation"
                placeholder="https://app.grotto.com/invite/…"
            />
        </TextField>
    );
}

/** Accepts an invitation link or bare token and opens its invitation page. */
export function JoinServerForm() {
    const form = useJoinServerForm();

    return (
        <Form
            className="flex flex-col items-stretch gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                form.submit();
            }}
        >
            <JoinServerFields form={form} />
            <div className="mt-1">
                <Button isDisabled={!form.isSubmittable} type="submit" variant="secondary">
                    Continue
                </Button>
            </div>
        </Form>
    );
}
