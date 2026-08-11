import {
    Alert,
    Button,
    FieldError,
    Form,
    Input,
    Label,
    Link,
    Modal,
    TextField,
} from '@heroui/react';
import * as React from 'react';
import { CodeSnippet } from '../../../components/code-snippet.tsx';
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
    const formId = `provider-api-key-form-${keyEnv}`;

    React.useEffect(() => {
        if (open) {
            setApiKey('');
        }
    }, [open]);

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>API Key</Modal.Heading>
                            <p className="mt-1.5 text-muted text-sm leading-5">
                                Enter your {label} API key to enable {label} models.
                            </p>
                        </Modal.Header>
                        <Modal.Body>
                            <Form
                                id={formId}
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (apiKey.trim().length > 0) {
                                        onSave(apiKey);
                                    }
                                }}
                            >
                                <TextField
                                    fullWidth
                                    isInvalid={Boolean(saveError)}
                                    onChange={setApiKey}
                                    type="password"
                                    value={apiKey}
                                    variant="secondary"
                                >
                                    <Label htmlFor={`provider-api-key-${keyEnv}`}>API Key</Label>
                                    <Input
                                        autoCapitalize="none"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        id={`provider-api-key-${keyEnv}`}
                                        name="provider-api-key"
                                        placeholder={placeholder}
                                        spellCheck={false}
                                    />
                                    {saveError ? <FieldError>{saveError}</FieldError> : null}
                                </TextField>
                            </Form>
                        </Modal.Body>

                        <Modal.Footer>
                            <Button
                                isDisabled={savePending}
                                slot="close"
                                type="button"
                                variant="secondary"
                            >
                                Cancel
                            </Button>
                            <Button
                                form={formId}
                                isDisabled={savePending || apiKey.trim().length === 0}
                                isPending={savePending}
                                type="submit"
                            >
                                Save
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>
                                Set Up {provider?.displayName ?? 'Provider'}
                            </Modal.Heading>
                            <p className="mt-1.5 text-muted text-sm leading-5">
                                Configure this provider for your agent, then refresh Grotto models.
                            </p>
                        </Modal.Header>

                        <Modal.Body>
                            <CodeSnippet
                                lines={
                                    provider?.connectionDetail ??
                                    provider?.stateMessage ??
                                    'No setup hint.'
                                }
                            />
                        </Modal.Body>

                        <Modal.Footer>
                            <Button slot="close" type="button" variant="secondary">
                                Done
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
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
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>Sign In</Modal.Heading>
                            <p className="mt-1.5 text-muted text-sm leading-5">
                                {label} sign-in started for your agent.
                            </p>
                        </Modal.Header>

                        <Modal.Body>
                            {result?.flow === 'pkce' ? (
                                <Form
                                    id="provider-oauth-code-form"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        if (code.trim()) {
                                            onSubmitCode(code);
                                        }
                                    }}
                                >
                                    <div className="space-y-3 text-sm">
                                        {'authUrl' in result ? (
                                            <div>
                                                Open{' '}
                                                <Link
                                                    href={result.authUrl}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    {result.authUrl}
                                                </Link>
                                            </div>
                                        ) : null}
                                        <div className="text-muted">
                                            Paste the authorization code from the browser.
                                        </div>
                                        <TextField
                                            fullWidth
                                            isInvalid={Boolean(submitError)}
                                            onChange={setCode}
                                            value={code}
                                            variant="secondary"
                                        >
                                            <Label htmlFor="provider-oauth-code">
                                                Authorization Code
                                            </Label>
                                            <Input id="provider-oauth-code" />
                                            {submitError ? (
                                                <FieldError>{submitError}</FieldError>
                                            ) : null}
                                        </TextField>
                                    </div>
                                </Form>
                            ) : (
                                <>
                                    {result?.flow === 'device_code' ? (
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                Open{' '}
                                                <Link
                                                    href={result.verificationUrl}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    {result.verificationUrl}
                                                </Link>
                                            </div>
                                            <CodeSnippet lines={result.userCode} />
                                        </div>
                                    ) : result && 'authUrl' in result ? (
                                        <div className="space-y-3 text-sm">
                                            <div className="text-muted">
                                                Continue in the browser window that just opened.
                                            </div>
                                            <div>
                                                Open{' '}
                                                <Link
                                                    href={result.authUrl}
                                                    rel="noreferrer"
                                                    target="_blank"
                                                >
                                                    {result.authUrl}
                                                </Link>
                                            </div>
                                        </div>
                                    ) : null}
                                    {pollError ? (
                                        <Alert className="mt-3" status="danger">
                                            <Alert.Indicator />
                                            <Alert.Content>
                                                <Alert.Description>{pollError}</Alert.Description>
                                            </Alert.Content>
                                        </Alert>
                                    ) : null}
                                    {pollStatus && pollStatus !== 'pending' ? (
                                        <p className="mt-3 text-muted text-sm">
                                            Sign-in status: {pollStatus}
                                        </p>
                                    ) : null}
                                </>
                            )}
                        </Modal.Body>

                        <Modal.Footer>
                            {result?.flow === 'pkce' ? (
                                <>
                                    <Button
                                        isDisabled={submitPending}
                                        slot="close"
                                        variant="secondary"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        form="provider-oauth-code-form"
                                        isDisabled={!code.trim()}
                                        isPending={submitPending}
                                        type="submit"
                                    >
                                        Submit
                                    </Button>
                                </>
                            ) : (
                                <Button slot="close" type="button" variant="secondary">
                                    Done
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
