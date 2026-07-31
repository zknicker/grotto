import {
    Button,
    Disclosure,
    Drawer,
    Form,
    Input,
    Label,
    ListBox,
    Select,
    TextField,
} from '@heroui/react';
import type * as React from 'react';
import { useState } from 'react';
import { SecretFieldsEditor } from './mcp-secret-fields.tsx';
import {
    buildSaveInput,
    createConnectionDraft,
    type McpConnectionDraft,
    type McpConnectionSaveInput,
} from './mcp-server-shared.ts';

export function McpConnectionFormDrawer({
    onOpenChange,
    onSave,
    open,
    saving,
}: {
    onOpenChange: (open: boolean) => void;
    onSave: (input: McpConnectionSaveInput) => void;
    open: boolean;
    saving: boolean;
}) {
    const [draft, setDraft] = useState(createConnectionDraft);
    const canSave = Boolean(draft.name.trim() && draft.url.trim());

    return (
        <Drawer isOpen={open} onOpenChange={onOpenChange}>
            <Drawer.Backdrop>
                <Drawer.Content placement="right">
                    <Drawer.Dialog>
                        <Drawer.CloseTrigger />
                        <Form
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (canSave) {
                                    onSave(buildSaveInput(draft));
                                }
                            }}
                        >
                            <Drawer.Header>
                                <Drawer.Heading>Add MCP Server</Drawer.Heading>
                            </Drawer.Header>
                            <Drawer.Body>
                                <div className="grid gap-6">
                                    <LabeledField
                                        label="Name"
                                        onChange={(name) => update(setDraft, { name })}
                                        value={draft.name}
                                    >
                                        <Input placeholder="My MCP Server" />
                                    </LabeledField>
                                    <HttpConnectionFields draft={draft} setDraft={setDraft} />
                                </div>
                            </Drawer.Body>
                            <Drawer.Footer>
                                <Button slot="close" type="button" variant="secondary">
                                    Cancel
                                </Button>
                                <Button isDisabled={!canSave} isPending={saving} type="submit">
                                    Add Connection
                                </Button>
                            </Drawer.Footer>
                        </Form>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    );
}

function HttpConnectionFields({
    draft,
    setDraft,
}: {
    draft: McpConnectionDraft;
    setDraft: React.Dispatch<React.SetStateAction<McpConnectionDraft>>;
}) {
    return (
        <>
            <LabeledField
                label="URL"
                onChange={(url) => update(setDraft, { url })}
                type="url"
                value={draft.url}
            >
                <Input placeholder="https://example.com/mcp" />
            </LabeledField>
            <Select
                fullWidth
                onChange={(value) =>
                    update(setDraft, {
                        auth:
                            value === 'oauth' ? 'oauth' : value === 'headers' ? 'headers' : 'none',
                    })
                }
                value={draft.auth}
                variant="secondary"
            >
                <Label>Authentication</Label>
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        <ListBox.Item id="none" textValue="None">
                            <Label>None</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="oauth" textValue="OAuth">
                            <Label>OAuth</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="headers" textValue="Secret Headers">
                            <Label>Secret Headers</Label>
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    </ListBox>
                </Select.Popover>
            </Select>
            {draft.auth === 'headers' ? (
                <SecretFieldsEditor
                    addLabel="Add Header"
                    entries={draft.headers}
                    onChange={(headers) => update(setDraft, { headers })}
                    title="Secret Headers"
                />
            ) : null}
            {draft.auth === 'oauth' ? (
                <OAuthAdvancedFields draft={draft} setDraft={setDraft} />
            ) : null}
            <p className="text-muted text-xs">
                Only connect servers from developers you trust. Their tools and behavior can change.
            </p>
        </>
    );
}

function OAuthAdvancedFields({
    draft,
    setDraft,
}: {
    draft: McpConnectionDraft;
    setDraft: React.Dispatch<React.SetStateAction<McpConnectionDraft>>;
}) {
    return (
        <Disclosure>
            <Disclosure.Heading>
                <Button slot="trigger" variant="ghost">
                    Advanced OAuth Settings
                    <Disclosure.Indicator />
                </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
                <Disclosure.Body>
                    <div className="grid gap-4">
                        <LabeledField
                            label="Client ID"
                            onChange={(oauthClientId) => update(setDraft, { oauthClientId })}
                            value={draft.oauthClientId}
                        >
                            <Input placeholder="Optional — dynamic registration is the default" />
                        </LabeledField>
                        <LabeledField
                            label="Client Secret"
                            onChange={(oauthClientSecret) =>
                                update(setDraft, { oauthClientSecret })
                            }
                            type="password"
                            value={draft.oauthClientSecret}
                        >
                            <Input placeholder="Optional" />
                        </LabeledField>
                        <LabeledField
                            label="Scopes"
                            onChange={(oauthScopes) => update(setDraft, { oauthScopes })}
                            value={draft.oauthScopes}
                        >
                            <Input placeholder="Space-separated, optional" />
                        </LabeledField>
                    </div>
                </Disclosure.Body>
            </Disclosure.Content>
        </Disclosure>
    );
}

function LabeledField({
    children,
    label,
    onChange,
    type = 'text',
    value,
}: {
    children: React.ReactNode;
    label: string;
    onChange?: (value: string) => void;
    type?: 'password' | 'text' | 'url';
    value?: string;
}) {
    return (
        <TextField fullWidth onChange={onChange} type={type} value={value} variant="secondary">
            <Label>{label}</Label>
            {children}
        </TextField>
    );
}

function update(
    setDraft: React.Dispatch<React.SetStateAction<McpConnectionDraft>>,
    patch: Partial<McpConnectionDraft>
) {
    setDraft((current) => ({ ...current, ...patch }));
}
