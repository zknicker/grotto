import { Button, Form, Modal } from '@heroui/react';
import { useState } from 'react';
import { SecretFieldsEditor } from './mcp-secret-fields.tsx';
import {
    createSecretDraftEntry,
    type McpConnection,
    type SecretDraftEntry,
    toSecretRecord,
} from './mcp-server-shared.ts';

export function McpHeaderCredentialsDialog({
    connection,
    onOpenChange,
    onSave,
    open,
    saving,
}: {
    connection: McpConnection;
    onOpenChange: (open: boolean) => void;
    onSave: (headers: Record<string, string>) => Promise<void>;
    open: boolean;
    saving: boolean;
}) {
    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        {open ? (
                            <HeaderCredentialsForm
                                connection={connection}
                                onCancel={() => onOpenChange(false)}
                                onSave={onSave}
                                saving={saving}
                            />
                        ) : null}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function HeaderCredentialsForm({
    connection,
    onCancel,
    onSave,
    saving,
}: {
    connection: McpConnection;
    onCancel: () => void;
    onSave: (headers: Record<string, string>) => Promise<void>;
    saving: boolean;
}) {
    const [headers, setHeaders] = useState<SecretDraftEntry[]>(() =>
        connection.headerNames.length > 0
            ? connection.headerNames.map((name) => ({
                  ...createSecretDraftEntry(),
                  name,
              }))
            : [createSecretDraftEntry()]
    );
    const values = toSecretRecord(headers);
    const canSave =
        Object.keys(values).length > 0 &&
        headers.every((entry) => entry.name.trim().length === 0 || entry.value.length > 0);

    return (
        <Form
            onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                    void onSave(values).catch(() => undefined);
                }
            }}
        >
            <Modal.Header>
                <div>
                    <Modal.Heading>Connect {connection.name}</Modal.Heading>
                    <p className="mt-1 text-muted text-sm">
                        Enter the request headers this server uses for authentication. Existing
                        values are never shown.
                    </p>
                </div>
            </Modal.Header>
            <Modal.Body>
                <SecretFieldsEditor
                    addLabel="Add Header"
                    entries={headers}
                    onChange={setHeaders}
                    title="Headers"
                />
            </Modal.Body>
            <Modal.Footer>
                <Button onPress={onCancel} type="button" variant="secondary">
                    Cancel
                </Button>
                <Button isDisabled={!canSave} isPending={saving} type="submit">
                    Save Credentials
                </Button>
            </Modal.Footer>
        </Form>
    );
}
