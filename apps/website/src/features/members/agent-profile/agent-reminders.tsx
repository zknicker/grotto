import type { Agent } from '@grotto/api';
import { Button, Separator } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import * as React from 'react';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { AgentLoading } from './agent-loading.tsx';
import { formatReminderSchedule, scheduledReminders } from './agent-reminder-model.ts';
import { ProfileListSection } from './profile-list-section.tsx';
import { ReminderHistoryDrawer } from './reminder-history-drawer.tsx';

/**
 * The Agent's time-based wakes. Read-only: authoring is a CLI verb.
 *
 * "Reminders 3" means three wakes are still coming, so the count and the list
 * are the schedule alone. What has already happened is a log of executions
 * rather than a second list of reminders, and it is the one rare question this
 * section answers, so it rides the header as a single control that opens a
 * drawer.
 */
export function AgentReminders({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const canView = server.role !== 'member';
    const reminders = useAgentReminders(server.id, agent.id, canView);
    const [isHistoryOpen, setHistoryOpen] = React.useState(false);

    if (canView && reminders.isPending) {
        return <AgentLoading label="Loading reminders" />;
    }

    const scheduled = scheduledReminders(reminders.data ?? []);

    return (
        <>
            <ProfileListSection
                action={
                    canView ? (
                        <Button
                            onPress={() => setHistoryOpen(true)}
                            size="sm"
                            type="button"
                            variant="secondary"
                        >
                            History
                        </Button>
                    ) : null
                }
                count={scheduled.length}
                title="Reminders"
            >
                {scheduled.length === 0 ? (
                    <ProfileListSection.Empty>
                        Nothing scheduled. Just tell {agent.displayName} what to remember and when.
                    </ProfileListSection.Empty>
                ) : (
                    scheduled.map((reminder, index) => (
                        <React.Fragment key={reminder.id}>
                            {index > 0 ? <Separator /> : null}
                            <ItemCard>
                                <ItemCard.Content>
                                    <ItemCard.Title>{reminder.title}</ItemCard.Title>
                                    <ItemCard.Description className="tabular-nums">
                                        {formatReminderSchedule(reminder)}
                                    </ItemCard.Description>
                                </ItemCard.Content>
                            </ItemCard>
                        </React.Fragment>
                    ))
                )}
            </ProfileListSection>
            {canView ? (
                <ReminderHistoryDrawer
                    agentId={agent.id}
                    isOpen={isHistoryOpen}
                    onOpenChange={setHistoryOpen}
                    serverId={server.id}
                    serverSlug={server.slug}
                />
            ) : null}
        </>
    );
}
