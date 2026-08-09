import { Button } from '@heroui/react';
import { CheckmarkCircle02Icon } from '@hugeicons-pro/core-stroke-rounded';
import { useSearchParams } from 'react-router-dom';
import { ActivationShell, ActivationStep } from '../../components/activation/activation-shell.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { grottoTrpc } from '../../lib/grotto-server.tsx';

/** Browser-only, one-use approval for a Computer setup invocation. */
export function ComputerApprovalPage() {
    const [search] = useSearchParams();
    const approvalId = search.get('approval') ?? '';
    const secret = search.get('secret') ?? '';
    const approval = grottoTrpc.computer.approve.useMutation();
    const invalid = approvalId.length === 0 || secret.length === 0;

    return (
        <ActivationShell>
            <ActivationStep
                description="Server Owners and Admins can use this Computer’s configured execution capacity."
                footer={
                    approval.isSuccess ? null : (
                        <Button
                            isDisabled={invalid}
                            isPending={approval.isPending}
                            onPress={() => approval.mutate({ approvalId, secret })}
                        >
                            Approve Computer
                        </Button>
                    )
                }
                title="Attach This Computer?"
            >
                {approval.isSuccess ? (
                    <p className="flex items-center justify-center gap-2 text-sm">
                        <Icon
                            aria-hidden="true"
                            className="shrink-0 text-success"
                            icon={CheckmarkCircle02Icon}
                            size={16}
                        />
                        Approved. Return to Grotto Computer.
                    </p>
                ) : null}
                {approval.error ? (
                    <p className="text-center text-danger text-sm">{approval.error.message}</p>
                ) : null}
            </ActivationStep>
        </ActivationShell>
    );
}
