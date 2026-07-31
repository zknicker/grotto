import * as React from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Field, FieldError, FieldLabel } from '../../../components/ui/primitives/field.tsx';
import { Form } from '../../../components/ui/primitives/form.tsx';
import { Input } from '../../../components/ui/primitives/input.tsx';
import type { useStartModelProviderOAuth } from '../../../hooks/connections/use-start-model-provider-oauth.ts';
import type { ModelInventoryOutput } from '../../../lib/trpc.tsx';

type ModelInventoryProvider = ModelInventoryOutput['providers'][number];

interface ProviderApiKeyDialogProps {
    keyEnv: string;
    label: string;
    onOpenChange: (open: boolean) => void;
    onSave: (apiKey: string) => void;
    open: boolean;
    saveError: string | null;
    savePending: boolean;
}

export function ProviderApiKeyDialog({
    keyEnv,
    label,
    onOpenChange,
    onSave,
    open,
    saveError,
    savePending,
}: ProviderApiKeyDialogProps) {
    const [apiKey, setApiKey] = React.useState('');
    const placeholder = apiKeyPlaceholder(label);

    React.useEffect(() => {
        if (open) {
            setApiKey('');
        }
    }, [open]);

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>API Key</DialogTitle>
                    <DialogDescription>
                        Enter your {label} API key to enable {label} models.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    className="contents"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (apiKey.trim().length > 0) {
                            onSave(apiKey);
                        }
                    }}
                >
                    <DialogPanel>
                        <Field>
                            <FieldLabel htmlFor={`provider-api-key-${keyEnv}`}>API Key</FieldLabel>
                            <Input
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect="off"
                                id={`provider-api-key-${keyEnv}`}
                                name="provider-api-key"
                                onChange={(event) => setApiKey(event.target.value)}
                                placeholder={placeholder}
                                spellCheck={false}
                                type="password"
                                value={apiKey}
                            />
                            {saveError ? <FieldError>{saveError}</FieldError> : null}
                        </Field>
                    </DialogPanel>

                    <DialogFooter variant="bare">
                        <DialogClose
                            disabled={savePending}
                            render={<Button size="sm" type="button" variant="secondary" />}
                        >
                            Cancel
                        </DialogClose>
                        <Button
                            disabled={savePending || apiKey.trim().length === 0}
                            size="sm"
                            type="submit"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function apiKeyPlaceholder(label: string) {
    const normalizedLabel = label.trim().toLowerCase();
    if (normalizedLabel.includes('openai')) {
        return 'sk-proj-...';
    }
    if (normalizedLabel.includes('openrouter')) {
        return 'sk-or-...';
    }
    return 'key-...';
}

export function ProviderInstructionsDialog({
    onOpenChange,
    open,
    provider,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    provider: ModelInventoryProvider | null;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Up {provider?.displayName ?? 'Provider'}</DialogTitle>
                    <DialogDescription>
                        Configure this provider for your agent, then refresh Grotto models.
                    </DialogDescription>
                </DialogHeader>

                <DialogPanel>
                    <div className="rounded-lg bg-legacy-muted px-3 py-2 font-mono text-sm">
                        {provider?.connectionDetail ?? provider?.stateMessage ?? 'No setup hint.'}
                    </div>
                </DialogPanel>

                <DialogFooter>
                    <DialogClose render={<Button size="sm" type="button" variant="secondary" />}>
                        Done
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ProviderOAuthDialog({
    label,
    onOpenChange,
    onSubmitCode,
    open,
    pollError,
    pollStatus,
    result,
    submitError,
    submitPending,
}: {
    label: string;
    onOpenChange: (open: boolean) => void;
    onSubmitCode: (code: string) => void;
    open: boolean;
    pollError: string | null;
    pollStatus: string | null;
    result: NonNullable<ReturnType<typeof useStartModelProviderOAuth>['data']> | null;
    submitError: string | null;
    submitPending: boolean;
}) {
    const [code, setCode] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setCode('');
        }
    }, [open]);

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sign In</DialogTitle>
                    <DialogDescription>{label} sign-in started for your agent.</DialogDescription>
                </DialogHeader>

                {result?.flow === 'pkce' ? (
                    <Form
                        className="contents"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (code.trim()) {
                                onSubmitCode(code);
                            }
                        }}
                    >
                        <DialogPanel>
                            <div className="space-y-3 text-sm">
                                {'authUrl' in result ? (
                                    <div>
                                        Open{' '}
                                        <a
                                            className="font-medium text-brand underline"
                                            href={result.authUrl}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            {result.authUrl}
                                        </a>
                                    </div>
                                ) : null}
                                <div className="text-muted-foreground">
                                    Paste the authorization code from the browser.
                                </div>
                                <Field>
                                    <FieldLabel htmlFor="provider-oauth-code">
                                        Authorization Code
                                    </FieldLabel>
                                    <Input
                                        id="provider-oauth-code"
                                        onChange={(event) => setCode(event.target.value)}
                                        value={code}
                                    />
                                    {submitError ? <FieldError>{submitError}</FieldError> : null}
                                </Field>
                            </div>
                        </DialogPanel>

                        <DialogFooter>
                            <DialogClose
                                disabled={submitPending}
                                render={<Button size="sm" type="button" variant="secondary" />}
                            >
                                Cancel
                            </DialogClose>
                            <Button
                                disabled={!code.trim()}
                                loading={submitPending}
                                size="sm"
                                type="submit"
                            >
                                Submit
                            </Button>
                        </DialogFooter>
                    </Form>
                ) : (
                    <>
                        <DialogPanel>
                            {result?.flow === 'device_code' ? (
                                <div className="space-y-3 text-sm">
                                    <div>
                                        Open{' '}
                                        <a
                                            className="font-medium text-brand underline"
                                            href={result.verificationUrl}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            {result.verificationUrl}
                                        </a>
                                    </div>
                                    <div className="rounded-lg bg-legacy-muted px-3 py-2 font-mono text-base">
                                        {result.userCode}
                                    </div>
                                </div>
                            ) : result && 'authUrl' in result ? (
                                <div className="space-y-3 text-sm">
                                    <div className="text-muted-foreground">
                                        Continue in the browser window that just opened.
                                    </div>
                                    <div>
                                        Open{' '}
                                        <a
                                            className="font-medium text-brand underline"
                                            href={result.authUrl}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            {result.authUrl}
                                        </a>
                                    </div>
                                </div>
                            ) : null}
                            {pollError ? (
                                <p className="mt-3 text-danger text-sm">{pollError}</p>
                            ) : null}
                            {pollStatus && pollStatus !== 'pending' ? (
                                <p className="mt-3 text-muted-foreground text-sm">
                                    Sign-in status: {pollStatus}
                                </p>
                            ) : null}
                        </DialogPanel>

                        <DialogFooter>
                            <DialogClose
                                render={<Button size="sm" type="button" variant="secondary" />}
                            >
                                Done
                            </DialogClose>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
