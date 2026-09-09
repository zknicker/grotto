import type { Agent } from '@grotto/api';
import { ItemCard } from '@heroui-pro/react';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import { useAgentTriggers } from '../../../hooks/members/use-agent-triggers.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { scheduledReminders } from '../agent-profile/agent-reminder-model.ts';
import { formatAutomationsSummary } from './agent-peek-model.ts';
import { PeekPressableCard, PeekSection } from './peek-section.tsx';

/**
 * One line for everything that can wake this Agent on its own: the Reminders
 * still scheduled and the Triggers still armed. The counts are the peek's whole
 * claim — authoring either one is the profile's Automations tab.
 *
 * `reminder.list` and `trigger.list` are operator reads, so a member has no
 * section at all: asking anyway would answer a 403 with "No automations", a
 * fact the Server never stated, and members cannot reach automations on any
 * other surface either.
 */
export function AgentPeekAutomations({
    agent,
    onOpenAutomations,
    server,
}: {
    agent: Agent;
    onOpenAutomations: () => void;
    server: ServerDetail;
}) {
    const canView = server.role !== 'member';
    const reminders = useAgentReminders(server.id, agent.id, canView);
    const triggers = useAgentTriggers(server.id, agent.id, canView);

    if (!canView) {
        return null;
    }

    const settled = !(reminders.isPending || triggers.isPending);
    const summary = settled
        ? formatAutomationsSummary({
              reminders: scheduledReminders(reminders.data ?? []).length,
              triggers: (triggers.data ?? []).filter((trigger) => trigger.status === 'armed')
                  .length,
          })
        : null;

    return (
        <PeekSection title="Automations">
            {summary ? (
                <PeekPressableCard
                    label="Open this Agent's automations"
                    onPress={onOpenAutomations}
                >
                    <ItemCard.Content>
                        <ItemCard.Title>{summary}</ItemCard.Title>
                    </ItemCard.Content>
                </PeekPressableCard>
            ) : null}
        </PeekSection>
    );
}
