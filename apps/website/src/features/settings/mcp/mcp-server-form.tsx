import { ArrowRight01Icon } from '@hugeicons-pro/core-stroke-rounded';
import type * as React from 'react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
} from '../../../components/ui/collapsible.tsx';
import {
    Drawer,
    DrawerFooter,
    DrawerHeader,
    DrawerPanel,
    DrawerPopup,
    DrawerTitle,
} from '../../../components/ui/drawer.tsx';
import { Icon } from '../../../components/ui/icon.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../../components/ui/select.tsx';
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
        <Drawer onOpenChange={onOpenChange} open={open} position="right">
            <DrawerPopup className="max-w-[600px] sm:w-[600px]" showCloseButton variant="inset">
                <DrawerHeader>
                    <DrawerTitle>Add MCP server</DrawerTitle>
                </DrawerHeader>
                <Form
                    className="contents"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (canSave) {
                            onSave(buildSaveInput(draft));
                        }
                    }}
                >
                    <DrawerPanel className="grid gap-6">
                        <LabeledField label="Name">
                            <Input
                                onChange={(event) => update(setDraft, { name: event.target.value })}
                                placeholder="My MCP server"
                                type="text"
                                value={draft.name}
                            />
                        </LabeledField>
                        <HttpConnectionFields draft={draft} setDraft={setDraft} />
                    </DrawerPanel>
                    <DrawerFooter>
                        <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
                            Cancel
                        </Button>
                        <Button disabled={!canSave} loading={saving} type="submit">
                            Add connection
                        </Button>
                    </DrawerFooter>
                </Form>
            </DrawerPopup>
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
            <LabeledField label="URL">
                <Input
                    onChange={(event) => update(setDraft, { url: event.target.value })}
                    placeholder="https://example.com/mcp"
                    type="url"
                    value={draft.url}
                />
            </LabeledField>
            <LabeledField label="Authentication">
                <Select
                    onValueChange={(value) =>
                        update(setDraft, {
                            auth:
                                value === 'oauth'
                                    ? 'oauth'
                                    : value === 'headers'
                                      ? 'headers'
                                      : 'none',
                        })
                    }
                    value={draft.auth}
                >
                    <SelectTrigger>
                        <SelectValue>{authLabel(draft.auth)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="oauth">OAuth</SelectItem>
                        <SelectItem value="headers">Secret headers</SelectItem>
                    </SelectContent>
                </Select>
            </LabeledField>
            {draft.auth === 'headers' ? (
                <SecretFieldsEditor
                    addLabel="Add header"
                    entries={draft.headers}
                    onChange={(headers) => update(setDraft, { headers })}
                    title="Secret headers"
                />
            ) : null}
            {draft.auth === 'oauth' ? (
                <OAuthAdvancedFields draft={draft} setDraft={setDraft} />
            ) : null}
            <p className="text-meta text-muted-foreground">
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
        <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center gap-1.5 rounded-md py-1 text-muted-foreground text-sm hover:text-foreground">
                <Icon
                    className="size-3 transition-transform group-data-[panel-open]:rotate-90"
                    icon={ArrowRight01Icon}
                />
                Advanced OAuth settings
            </CollapsibleTrigger>
            <CollapsiblePanel>
                <div className="grid gap-4 pt-3">
                    <LabeledField label="Client ID">
                        <Input
                            onChange={(event) =>
                                update(setDraft, { oauthClientId: event.target.value })
                            }
                            placeholder="Optional — dynamic registration is the default"
                            type="text"
                            value={draft.oauthClientId}
                        />
                    </LabeledField>
                    <LabeledField label="Client secret">
                        <Input
                            onChange={(event) =>
                                update(setDraft, { oauthClientSecret: event.target.value })
                            }
                            placeholder="Optional"
                            type="password"
                            value={draft.oauthClientSecret}
                        />
                    </LabeledField>
                    <LabeledField label="Scopes">
                        <Input
                            onChange={(event) =>
                                update(setDraft, { oauthScopes: event.target.value })
                            }
                            placeholder="Space-separated, optional"
                            type="text"
                            value={draft.oauthScopes}
                        />
                    </LabeledField>
                </div>
            </CollapsiblePanel>
        </Collapsible>
    );
}

function LabeledField({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <Field render={<label />}>
            <FieldLabel render={<span />}>{label}</FieldLabel>
            {children}
        </Field>
    );
}

function update(
    setDraft: React.Dispatch<React.SetStateAction<McpConnectionDraft>>,
    patch: Partial<McpConnectionDraft>
) {
    setDraft((current) => ({ ...current, ...patch }));
}

function authLabel(auth: McpConnectionDraft['auth']) {
    if (auth === 'oauth') {
        return 'OAuth';
    }
    if (auth === 'headers') {
        return 'Secret headers';
    }
    return 'None';
}
