import { Button } from '@heroui/react';
import { useSearchParams } from 'react-router-dom';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Browser-only, one-use approval for a Computer setup invocation. */
export function ComputerApprovalPage() {
    const [search] = useSearchParams();
    const approvalId = search.get('approval') ?? '';
    const secret = search.get('secret') ?? '';
    const approval = grottoTrpc.computer.approve.useMutation();
    const invalid = approvalId.length === 0 || secret.length === 0;

    return (
        <main className="grid min-h-dvh place-content-center gap-4 px-6 text-center">
            <div className="space-y-1">
                <h1 className="font-semibold text-foreground text-xl">Attach this Computer?</h1>
                <p className="max-w-sm text-muted text-sm">
                    Server Owners and Admins can use this Computer’s configured execution capacity.
                </p>
            </div>
            {approval.isSuccess ? (
                <p className="text-muted text-sm">Approved. Return to Grotto Computer.</p>
            ) : (
                <Button
                    isDisabled={invalid}
                    isPending={approval.isPending}
                    onPress={() => approval.mutate({ approvalId, secret })}
                >
                    Approve Computer
                </Button>
            )}
            {approval.error ? (
                <p className="text-danger text-sm">{approval.error.message}</p>
            ) : null}
        </main>
    );
}
