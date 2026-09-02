import type { Agent, AgentCreatePreparedAction } from '@grotto/api';
import { Button, Chip } from '@heroui/react';
import * as React from 'react';
import { ActionCard } from '../../components/chats/action-card.tsx';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { openAgentProfilePane } from '../../hooks/pane/use-agent-profile-pane.ts';
import { formatShortTime } from '../../lib/format.ts';
import { ActionCardExit } from './action-card-exit.tsx';
import { PreparedAgentCreateDialog } from './prepared-agent-create-dialog.tsx';

/**
 * The proposed Agent's face, name, and (once created) a `Chip` in
 * `ActionCard.Status` at the right end of the title row. A pending card is
 * the ask, so it carries no chip of its own. A superseded proposal shows
 * nothing: it collapses out live, and never appears if it arrives already
 * superseded.
 */
export function AgentCreateActionCard({
    action,
    agents,
    canManage,
    executedByDisplayName,
    serverId,
}: {
    action: AgentCreatePreparedAction;
    agents: readonly Agent[];
    canManage: boolean;
    executedByDisplayName?: string;
    serverId?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [hidden, setHidden] = React.useState(false);
    // Stable identity so the exit effect fires once, not on every re-render.
    const handleExited = React.useCallback(() => setHidden(true), []);
    const { proposal, result, status } = action;
    const superseded = status === 'superseded';
    // Tracks whether this card was ever on screen before going superseded,
    // so a proposal that arrives already-superseded renders nothing and
    // never plays the exit animation.
    const wasVisibleRef = React.useRef(!superseded);

    React.useEffect(() => {
        if (status !== 'pending') {
            setOpen(false);
        }
    }, [status]);

    if (!superseded) {
        wasVisibleRef.current = true;
    }

    const visibility = resolveAgentCreateCardVisibility({
        hidden,
        status,
        wasVisible: wasVisibleRef.current,
    });

    const name = result?.displayName ?? proposal.name;
    const avatarUrl = result?.avatarUrl ?? proposal.avatar.url;
    const subject = result ?? proposal;
    const description = subject.description;
    const receipt =
        result && executedByDisplayName
            ? `Created by ${executedByDisplayName} · ${formatShortTime(action.executedAt)}`
            : null;
    const actions = agentCreateActions({
        action,
        canManage,
        onReview: () => setOpen(true),
        serverId,
    });

    const card = (
        <ActionCard
            actionKind={action.kind}
            actionStatus={status}
            aria-label={`Agent proposal for ${name}${status === 'executed' ? ' · Created' : ''}`}
        >
            <ActionCard.Header>
                <ActionCard.Mark>
                    <EntityAvatar name={name} size={48} src={avatarUrl} />
                </ActionCard.Mark>
                <ActionCard.Content>
                    <ActionCard.Title>
                        {name}
                        {status === 'executed' ? (
                            <ActionCard.Status>
                                <Chip color="success" size="sm" variant="soft">
                                    <Chip.Label>Created</Chip.Label>
                                </Chip>
                            </ActionCard.Status>
                        ) : null}
                    </ActionCard.Title>
                    {description ? (
                        <ActionCard.Description>{description}</ActionCard.Description>
                    ) : null}
                </ActionCard.Content>
            </ActionCard.Header>
            {actions ? (
                <ActionCard.Actions>
                    {actions}
                    {receipt ? <ActionCard.Receipt>{receipt}</ActionCard.Receipt> : null}
                </ActionCard.Actions>
            ) : null}
        </ActionCard>
    );
    // Freezes the last non-superseded card so the exit animation collapses
    // real content instead of the empty superseded render.
    const frozenCard = useFrozenValue(card, superseded);

    if (visibility === 'hidden') {
        return null;
    }

    if (visibility === 'exiting') {
        return <ActionCardExit onExited={handleExited}>{frozenCard}</ActionCardExit>;
    }

    return (
        <>
            {card}
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

export type AgentCreateCardVisibility = 'exiting' | 'hidden' | 'live';

/**
 * One canonical decision for what a live-updating proposal row shows: still
 * on screen, collapsing out after just having gone superseded, or gone for
 * good (either finished collapsing, or superseded from its very first
 * render, which never animates). Pure so the transition rule is testable
 * without mounting a DOM.
 */
export function resolveAgentCreateCardVisibility({
    hidden,
    status,
    wasVisible,
}: {
    hidden: boolean;
    status: AgentCreatePreparedAction['status'];
    wasVisible: boolean;
}): AgentCreateCardVisibility {
    if (hidden) {
        return 'hidden';
    }
    if (status !== 'superseded') {
        return 'live';
    }
    return wasVisible ? 'exiting' : 'hidden';
}

/**
 * A pending proposal is work the human owes; a created Agent is a place to
 * go. A viewer who cannot commit, or a superseded proposal, gets no bottom
 * row at all — the card omits the part rather than rendering it empty.
 */
function agentCreateActions({
    action,
    canManage,
    onReview,
    serverId,
}: {
    action: AgentCreatePreparedAction;
    canManage: boolean;
    onReview: () => void;
    serverId?: string;
}): React.ReactNode {
    const { result } = action;

    if (result) {
        return (
            <Button
                onPress={() => openAgentProfilePane(action.chatId, result.agentId)}
                size="sm"
                variant="secondary"
            >
                Open
            </Button>
        );
    }

    if (action.status === 'pending' && canManage && serverId) {
        return (
            <Button onPress={onReview} size="sm" variant="primary">
                Create Agent
            </Button>
        );
    }

    return null;
}

function useFrozenValue<T>(value: T, freeze: boolean): T {
    const ref = React.useRef(value);

    if (!freeze) {
        ref.current = value;
    }

    return ref.current;
}
