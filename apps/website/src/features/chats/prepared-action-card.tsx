import type { Agent, AgentCreatePreparedAction, PreparedAction } from '@grotto/api';
import { isAgentCreatePreparedAction } from '@grotto/api/prepared-actions';
import { Button, Card, Chip } from '@heroui/react';
import * as React from 'react';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { formatShortTime } from '../../lib/format.ts';
import { PreparedAgentCreateDialog } from './prepared-agent-create-dialog.tsx';

export interface PreparedActionProposer {
    avatarUrl: string | null;
    displayName: string;
}

export function PreparedActionCard({
    action,
    agents = [],
    canManage = false,
    executedByDisplayName,
    proposer,
    serverId,
}: {
    action: PreparedAction;
    agents?: readonly Agent[];
    canManage?: boolean;
    executedByDisplayName?: string;
    proposer: PreparedActionProposer;
    serverId?: string;
}) {
    if (isAgentCreatePreparedAction(action)) {
        return (
            <AgentCreateActionCard
                action={action}
                agents={agents}
                canManage={canManage}
                executedByDisplayName={executedByDisplayName}
                proposer={proposer}
                serverId={serverId}
            />
        );
    }

    return (
        <PreparedActionCardShell action={action} proposer={proposer} title="Unsupported action">
            <p className="text-muted text-sm">
                This action is not available in this version of Grotto.
            </p>
        </PreparedActionCardShell>
    );
}

function AgentCreateActionCard({
    action,
    agents,
    canManage,
    executedByDisplayName,
    proposer,
    serverId,
}: {
    action: AgentCreatePreparedAction;
    agents: readonly Agent[];
    canManage: boolean;
    executedByDisplayName?: string;
    proposer: PreparedActionProposer;
    serverId?: string;
}) {
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (action.status !== 'pending') {
            setOpen(false);
        }
    }, [action.status]);

    return (
        <>
            <PreparedActionCardShell
                action={action}
                proposer={proposer}
                title="Agent creation proposal"
            >
                <AgentCreateActionPreview action={action} />
                {action.status === 'executed' && executedByDisplayName ? (
                    <p className="mt-4 text-muted text-sm">
                        Committed by{' '}
                        <span className="text-foreground">{executedByDisplayName}</span>
                    </p>
                ) : null}
                {action.status === 'pending' && canManage && serverId ? (
                    <div className="mt-4 flex justify-end">
                        <Button onPress={() => setOpen(true)} size="sm" variant="secondary">
                            Create Agent
                        </Button>
                    </div>
                ) : null}
                {action.status === 'pending' && !canManage ? (
                    <p className="mt-4 text-muted text-sm">
                        Only a Server Owner or Admin can commit this Agent.
                    </p>
                ) : null}
            </PreparedActionCardShell>
            {open && serverId ? (
                <PreparedAgentCreateDialog
                    action={action}
                    agents={agents}
                    onCommitted={() => setOpen(false)}
                    onOpenChange={setOpen}
                    open={open}
                    serverId={serverId}
                />
            ) : null}
        </>
    );
}

function PreparedActionCardShell({
    action,
    children,
    proposer,
    title,
}: {
    action: PreparedAction;
    children: React.ReactNode;
    proposer: PreparedActionProposer;
    title: string;
}) {
    return (
        <Card
            aria-label={`${title} from ${proposer.displayName}`}
            data-action-kind={action.kind}
            data-action-status={action.status}
            role="article"
        >
            <Card.Header>
                <div className="flex min-w-0 items-start gap-3">
                    <EntityAvatar name={proposer.displayName} size={32} src={proposer.avatarUrl} />
                    <div className="min-w-0 flex-1">
                        <Card.Title>{title}</Card.Title>
                        <Card.Description>
                            Prepared by {proposer.displayName} ·{' '}
                            <time dateTime={action.createdAt}>
                                {formatShortTime(action.createdAt)}
                            </time>
                        </Card.Description>
                    </div>
                    <PreparedActionStatus status={action.status} />
                </div>
            </Card.Header>
            <Card.Content>{children}</Card.Content>
        </Card>
    );
}

function AgentCreateActionPreview({ action }: { action: AgentCreatePreparedAction }) {
    const { proposal } = action;
    const computer = proposal.computer;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 items-center gap-3">
                <EntityAvatar name={proposal.name} size={72} src={proposal.avatar.url} />
                <div className="min-w-0">
                    <p className="text-muted text-xs uppercase tracking-wide">New Agent</p>
                    <h3 className="truncate font-semibold text-foreground text-lg">
                        {proposal.name}
                    </h3>
                    {proposal.description ? (
                        <p className="text-muted text-sm">{proposal.description}</p>
                    ) : null}
                </div>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-[max-content_1fr] sm:gap-x-4">
                {computer ? (
                    <>
                        <dt className="text-muted">Computer</dt>
                        <dd>
                            {computer.label ?? computer.computerId} ({computer.kind})
                        </dd>
                    </>
                ) : null}
                {proposal.draftHint ? (
                    <>
                        <dt className="text-muted">Draft note</dt>
                        <dd className="whitespace-pre-wrap">{proposal.draftHint}</dd>
                    </>
                ) : null}
            </dl>
        </div>
    );
}

function PreparedActionStatus({ status }: { status: PreparedAction['status'] }) {
    const color = status === 'pending' ? 'warning' : status === 'executed' ? 'success' : 'default';

    return (
        <Chip color={color} size="sm" variant="soft">
            <Chip.Label>{statusLabel(status)}</Chip.Label>
        </Chip>
    );
}

function statusLabel(status: PreparedAction['status']) {
    switch (status) {
        case 'pending':
            return 'Pending review';
        case 'executed':
            return 'Done';
        case 'superseded':
            return 'Superseded';
    }
}
