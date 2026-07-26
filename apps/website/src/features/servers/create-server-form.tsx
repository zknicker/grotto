import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Field, FieldError, FieldLabel } from '../../components/ui/primitives/field.tsx';
import { Form } from '../../components/ui/primitives/form.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { useCreateServer } from '../../hooks/servers/use-create-server.ts';
import { serverRoute } from './server-routes.ts';

/** Creates a Grotto server and opens it at its new address. */
export function CreateServerForm() {
    const navigate = useNavigate();
    const createServer = useCreateServer();
    const [displayName, setDisplayName] = React.useState('');
    const [slug, setSlug] = React.useState('');

    return (
        <Form
            onSubmit={(event) => {
                event.preventDefault();
                createServer.mutate(
                    { displayName: displayName.trim(), slug: slug.trim() },
                    { onSuccess: (server) => navigate(serverRoute(server.slug)) }
                );
            }}
        >
            <Field>
                <FieldLabel htmlFor="server-display-name">Name</FieldLabel>
                <Input
                    autoComplete="off"
                    id="server-display-name"
                    onChange={(event) => setDisplayName(event.currentTarget.value)}
                    placeholder="Grotto HQ"
                    value={displayName}
                />
            </Field>
            <Field>
                <FieldLabel htmlFor="server-slug">Address</FieldLabel>
                <Input
                    autoComplete="off"
                    id="server-slug"
                    onChange={(event) => setSlug(event.currentTarget.value)}
                    placeholder="grotto-hq"
                    value={slug}
                />
                {createServer.error ? (
                    <FieldError role="alert">{createServer.error.message}</FieldError>
                ) : null}
            </Field>
            <Button
                className="self-start"
                disabled={displayName.trim().length === 0 || slug.trim().length === 0}
                loading={createServer.isPending}
                type="submit"
            >
                Create Server
            </Button>
        </Form>
    );
}
