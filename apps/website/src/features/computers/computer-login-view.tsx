import {
    Button,
    Description,
    FieldError,
    Form,
    Input,
    Label,
    Spinner,
    TextField,
} from '@heroui/react';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActivationShell, ActivationStep } from '../../components/activation/activation-shell.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

export type ComputerLoginStatus =
    | 'approved'
    | 'consumed'
    | 'denied'
    | 'expired'
    | 'malformed'
    | 'not-found'
    | 'pending';

export function ComputerLoginApproval({
    accountLabel,
    onSignIn,
    onSwitchAccount,
    signedIn,
}: {
    accountLabel: string | null;
    onSignIn: (() => void) | undefined;
    onSwitchAccount: (() => void) | undefined;
    signedIn: boolean;
}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [userCode, setUserCode] = React.useState(searchParams.get('code') ?? '');
    const codeFromUrl = searchParams.get('code') ?? '';
    const setupFlowFromUrl = searchParams.get('flow') === 'setup';
    const statusQuery = grottoTrpc.computer.login.status.useQuery(
        { userCode },
        {
            enabled: userCode.trim().length > 0,
            refetchInterval: (query) => (query.state.data?.status === 'approved' ? 1000 : false),
        }
    );
    const utils = grottoTrpc.useUtils();
    const approve = grottoTrpc.computer.login.approve.useMutation({
        onSuccess: (result, variables) => {
            utils.computer.login.status.setData(
                { userCode: variables.userCode },
                setupFlowFromUrl ? { ...result, purpose: 'setup' } : result
            );
        },
    });
    const deny = grottoTrpc.computer.login.deny.useMutation({
        onSuccess: (result, variables) => {
            utils.computer.login.status.setData({ userCode: variables.userCode }, result);
        },
    });

    React.useEffect(() => {
        setUserCode(codeFromUrl);
    }, [codeFromUrl]);

    const status = statusQuery.data?.status;
    const setupFlow = Boolean(
        setupFlowFromUrl ||
            (statusQuery.data &&
                'purpose' in statusQuery.data &&
                statusQuery.data.purpose === 'setup')
    );
    const isWorking = approve.isPending || deny.isPending;
    const submitCode = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextCode = userCode.trim().toUpperCase();
        approve.reset();
        deny.reset();
        setUserCode(nextCode);
        setSearchParams(
            nextCode ? { code: nextCode, ...(setupFlow ? { flow: 'setup' } : {}) } : {}
        );
    };

    return (
        <LoginFrame
            description={loginDescription(status, accountLabel, signedIn, setupFlow)}
            footer={
                <LoginActions
                    accountLabel={accountLabel}
                    isWorking={isWorking}
                    onApprove={() => approve.mutate({ userCode })}
                    onDeny={() => deny.mutate({ userCode })}
                    onSignIn={onSignIn}
                    onSwitchAccount={onSwitchAccount}
                    setupFlow={setupFlow}
                    signedIn={signedIn}
                    status={status}
                />
            }
            title={loginTitle(status, setupFlow)}
        >
            <Form className="w-full max-w-sm gap-3" onSubmit={submitCode}>
                <TextField
                    aria-label="Computer login code"
                    fullWidth
                    isDisabled={isWorking}
                    isInvalid={status === 'malformed'}
                    onChange={setUserCode}
                    value={userCode}
                >
                    <Label>Computer login code</Label>
                    <Input autoComplete="one-time-code" maxLength={9} placeholder="ABCD-EFGH" />
                    <Description>Enter the code shown by `grotto-computer login`.</Description>
                    {status === 'malformed' ? (
                        <FieldError>Use the eight-character code from your terminal.</FieldError>
                    ) : null}
                </TextField>
                <Button
                    isDisabled={isWorking || !userCode.trim()}
                    type="submit"
                    variant="secondary"
                >
                    Check code
                </Button>
            </Form>
            {statusQuery.isPending && userCode.trim() ? (
                <Spinner aria-label="Checking Computer login" size="sm" />
            ) : null}
            {statusQuery.error ? (
                <p className="text-center text-danger text-sm">{statusQuery.error.message}</p>
            ) : null}
            {approve.error || deny.error ? (
                <p className="text-center text-danger text-sm">
                    {(approve.error ?? deny.error)?.message}
                </p>
            ) : null}
        </LoginFrame>
    );
}

function LoginActions({
    accountLabel,
    isWorking,
    onApprove,
    onDeny,
    onSignIn,
    onSwitchAccount,
    setupFlow,
    signedIn,
    status,
}: {
    accountLabel: string | null;
    isWorking: boolean;
    onApprove: () => void;
    onDeny: () => void;
    onSignIn: (() => void) | undefined;
    onSwitchAccount: (() => void) | undefined;
    setupFlow: boolean;
    signedIn: boolean;
    status: ComputerLoginStatus | undefined;
}) {
    if (status === 'consumed') {
        if (setupFlow) {
            return (
                <div className="flex flex-col items-center gap-2">
                    <Button onPress={() => window.close()} variant="secondary">
                        Close this page
                    </Button>
                    <p className="text-center text-muted text-sm">
                        If this page stays open, close it manually.
                    </p>
                </div>
            );
        }
        return (
            <Button onPress={() => window.close()} variant="secondary">
                Close this page
            </Button>
        );
    }
    if (status === 'approved') {
        return <Spinner aria-label="Finishing Computer login" size="sm" />;
    }
    if (status !== 'pending') {
        return null;
    }
    if (!signedIn) {
        return onSignIn ? <Button onPress={onSignIn}>Sign in to approve</Button> : null;
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <Button isPending={isWorking} onPress={onApprove}>
                Approve Grotto Computer
            </Button>
            <Button isDisabled={isWorking} onPress={onDeny} variant="danger-soft">
                Deny
            </Button>
            {onSwitchAccount ? (
                <Button isDisabled={isWorking} onPress={onSwitchAccount} variant="ghost">
                    Use another account
                </Button>
            ) : null}
            {accountLabel ? (
                <span className="w-full text-center text-muted text-sm">
                    Active account: {accountLabel}
                </span>
            ) : null}
        </div>
    );
}

export function LoginFrame({
    children,
    description,
    footer,
    title,
}: {
    children?: React.ReactNode;
    description: string;
    footer?: React.ReactNode;
    title: string;
}) {
    return (
        <ActivationShell>
            <ActivationStep description={description} footer={footer} title={title}>
                {children}
            </ActivationStep>
        </ActivationShell>
    );
}

function loginTitle(status: ComputerLoginStatus | undefined, setupFlow: boolean) {
    switch (status) {
        case 'approved':
            return 'Signed in — finishing the connection';
        case 'consumed':
            return setupFlow
                ? 'Computer connected — you can close this page'
                : 'Grotto Computer signed in';
        case 'denied':
            return 'Computer login denied';
        case 'expired':
            return 'Computer login expired';
        case 'malformed':
            return 'Code not recognized';
        case 'not-found':
            return 'Computer login not found';
        case 'pending':
            return 'Approve Grotto Computer?';
        default:
            return 'Sign in Grotto Computer';
    }
}

function loginDescription(
    status: ComputerLoginStatus | undefined,
    accountLabel: string | null,
    signedIn: boolean,
    setupFlow: boolean
) {
    switch (status) {
        case 'approved':
            return 'Grotto Computer is completing its secure connection. Keep this page open for a moment.';
        case 'consumed':
            return setupFlow
                ? 'The Computer attachment is saved locally. You can close this page.'
                : 'The standalone Computer login is complete. You can close this page.';
        case 'denied':
            return 'This Computer login was denied. Start `grotto-computer login` again to try another request.';
        case 'expired':
            return 'This Computer login code expired. Start `grotto-computer login` again for a new code.';
        case 'malformed':
            return 'Enter the short code shown in your Grotto Computer terminal.';
        case 'not-found':
            return 'No Computer login is waiting for that code. Start `grotto-computer login` again.';
        case 'pending':
            return signedIn
                ? `Approve this request for ${accountLabel ?? 'your active account'}.`
                : 'Sign in with the account that should own this Computer login.';
        default:
            return 'Enter the short code shown by `grotto-computer login`.';
    }
}
