import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
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
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                {open ? (
                    <HeaderCredentialsForm
                        connection={connection}
                        onCancel={() => onOpenChange(false)}
                        onSave={onSave}
                        saving={saving}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
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
            className="contents"
            onSubmit={(event) => {
                event.preventDefault();
                if (canSave) {
                    void onSave(values).catch(() => undefined);
                }
            }}
        >
            <DialogHeader>
                <DialogTitle>Connect {connection.name}</DialogTitle>
                <DialogDescription>
                    Enter the request headers this server uses for authentication. Existing values
                    are never shown.
                </DialogDescription>
            </DialogHeader>
            <DialogPanel>
                <SecretFieldsEditor
                    addLabel="Add header"
                    entries={headers}
                    onChange={setHeaders}
                    title="Headers"
                />
            </DialogPanel>
            <DialogFooter variant="bare">
                <Button onClick={onCancel} type="button" variant="ghost">
                    Cancel
                </Button>
                <Button disabled={!canSave} loading={saving} type="submit">
                    Save credentials
                </Button>
            </DialogFooter>
        </Form>
    );
}
