import type { Trigger } from '@grotto/api';
import { Switch } from '@heroui/react';
import { useTriggerSetStatus } from '../../../hooks/members/use-trigger-set-status.ts';

/**
 * The kill switch, stated as the state it controls rather than as a one-way
 * action: armed accepts fires, disabled ignores them, and both directions are
 * the same toggle.
 */
export function TriggerActiveSwitch({
    agentId,
    serverId,
    trigger,
}: {
    agentId: string;
    serverId: string;
    trigger: Pick<Trigger, 'id' | 'status'>;
}) {
    const setStatus = useTriggerSetStatus(serverId, agentId);
    const isArmed = trigger.status === 'armed';

    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground text-sm">Active</span>
                <span className="text-muted text-sm">
                    {isArmed
                        ? 'Accepting fires at its URL.'
                        : 'Ignoring anything posted to its URL.'}
                </span>
            </div>
            <Switch
                aria-label="Active"
                isDisabled={setStatus.isPending}
                isSelected={isArmed}
                onChange={(selected) =>
                    setStatus.setStatus(trigger.id, selected ? 'armed' : 'disabled')
                }
            >
                <Switch.Content>
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Content>
            </Switch>
        </div>
    );
}
