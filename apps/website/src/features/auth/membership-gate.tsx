import { Button, Input, TextField } from '@heroui/react';
import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { isClerkEnabled } from '../../lib/clerk.tsx';
import { trpc } from '../../lib/trpc.tsx';

/**
 * Blocks the app for signed-in users who are not members of the connected
 * runtime (specs/identity.md): the runtime belongs to someone else until an
 * invite is redeemed. Unreachable runtimes and keyless dev mode pass through —
 * runtime setup and offline grace are owned by other gates.
 */
export function MembershipGate() {
    if (!isClerkEnabled) {
        return <Outlet />;
    }
    return <SignedInMembershipGate />;
}

function SignedInMembershipGate() {
    const me = trpc.identity.me.useQuery(undefined, {
        refetchOnWindowFocus: true,
    });
    if (me.data && me.data.role === null) {
        return <InviteRequired onJoined={() => me.refetch()} />;
    }
    return <Outlet />;
}

function InviteRequired({ onJoined }: { onJoined: () => void }) {
    const [code, setCode] = React.useState('');
    const redeem = trpc.identity.redeemInvite.useMutation({ onSuccess: onJoined });
    return (
        <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background px-6">
            <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="font-semibold text-2xl text-foreground">Invite required</h1>
                <p className="max-w-sm text-muted text-sm">
                    This Grotto belongs to someone else. Ask the owner for an invite code to join
                    the conversation.
                </p>
            </div>
            <form
                className="flex w-full max-w-sm items-center gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (code.trim()) {
                        redeem.mutate({ code: code.trim() });
                    }
                }}
            >
                <TextField aria-label="Invite code" fullWidth onChange={setCode} value={code}>
                    <Input placeholder="Invite code" />
                </TextField>
                <Button isDisabled={!code.trim()} isPending={redeem.isPending} type="submit">
                    Join
                </Button>
            </form>
            {redeem.error ? (
                <p className="max-w-sm text-center text-danger text-sm">{redeem.error.message}</p>
            ) : null}
        </div>
    );
}
