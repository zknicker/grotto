import { Button, FieldError, Form, Input, Label, TextField } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
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
            <TextField fullWidth onChange={setDisplayName} value={displayName}>
                <Label htmlFor="server-display-name">Name</Label>
                <Input autoComplete="off" id="server-display-name" placeholder="Grotto HQ" />
            </TextField>
            <TextField
                fullWidth
                isInvalid={Boolean(createServer.error)}
                onChange={setSlug}
                value={slug}
            >
                <Label htmlFor="server-slug">Address</Label>
                <Input autoComplete="off" id="server-slug" placeholder="grotto-hq" />
                {createServer.error ? <FieldError>{createServer.error.message}</FieldError> : null}
            </TextField>
            <Button
                className="self-start"
                isDisabled={displayName.trim().length === 0 || slug.trim().length === 0}
                isPending={createServer.isPending}
                type="submit"
            >
                Create Server
            </Button>
        </Form>
    );
}
