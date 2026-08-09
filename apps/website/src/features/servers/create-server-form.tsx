import { Button, FieldError, Form, Input, Label, TextField } from '@heroui/react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateServer } from '../../hooks/servers/use-create-server.ts';
import { serverRoute } from './server-routes.ts';
import { slugifyServerName } from './server-slug.ts';

/** Creates a Grotto server and opens it at its new address. */
export function CreateServerForm({ onCreated }: { onCreated?: () => void } = {}) {
    const navigate = useNavigate();
    const createServer = useCreateServer();
    const [displayName, setDisplayName] = React.useState('');
    const [slug, setSlug] = React.useState('');
    const [isSlugEdited, setIsSlugEdited] = React.useState(false);

    const handleDisplayNameChange = (nextDisplayName: string) => {
        setDisplayName(nextDisplayName);
        if (!isSlugEdited) {
            setSlug(slugifyServerName(nextDisplayName));
        }
    };

    const handleSlugChange = (nextSlug: string) => {
        setIsSlugEdited(true);
        setSlug(nextSlug);
    };

    return (
        <Form
            className="flex flex-col items-stretch gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                createServer.mutate(
                    { displayName: displayName.trim(), slug: slug.trim() },
                    {
                        onSuccess: (server) => {
                            onCreated?.();
                            navigate(serverRoute(server.slug));
                        },
                    }
                );
            }}
        >
            <TextField
                fullWidth
                onChange={handleDisplayNameChange}
                value={displayName}
                variant="secondary"
            >
                <Label htmlFor="server-display-name">Name</Label>
                <Input autoComplete="off" id="server-display-name" placeholder="Grotto HQ" />
            </TextField>
            <TextField
                fullWidth
                isInvalid={Boolean(createServer.error)}
                onChange={handleSlugChange}
                value={slug}
                variant="secondary"
            >
                <Label htmlFor="server-slug">Address</Label>
                <Input autoComplete="off" id="server-slug" placeholder="grotto-hq" />
                {createServer.error ? <FieldError>{createServer.error.message}</FieldError> : null}
            </TextField>
            <div className="mt-1">
                <Button
                    isDisabled={displayName.trim().length === 0 || slug.trim().length === 0}
                    isPending={createServer.isPending}
                    type="submit"
                >
                    Create Server
                </Button>
            </div>
        </Form>
    );
}
