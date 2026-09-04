import type { Agent } from '@grotto/api';
import { Separator } from '@heroui/react';
import { ItemCard } from '@heroui-pro/react';
import * as React from 'react';
import { useAgentReminders } from '../../../hooks/members/use-agent-reminders.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { AgentLoading } from './agent-loading.tsx';
import { ProfileListSection } from './profile-list-section.tsx';

/** The Agent's time-based wakes. Read-only: authoring is a CLI verb. */
export function AgentReminders({ agent, server }: { agent: Agent; server: ServerDetail }) {
    const canView = server.role !== 'member';
    const reminders = useAgentReminders(server.id, agent.id, canView);
    const rows = reminders.data ?? [];

    if (canView && reminders.isPending) {
        return <AgentLoading label="Loading reminders" />;
    }

    return (
        <ProfileListSection count={rows.length} title="Reminders">
            {rows.length === 0 ? (
                <ProfileListSection.Empty>
                    No reminders yet. Just tell {agent.displayName} what to remember and when.
                </ProfileListSection.Empty>
            ) : (
                rows.map((reminder, index) => (
                    <React.Fragment key={reminder.id}>
                        {index > 0 ? <Separator /> : null}
                        <ItemCard>
                            <ItemCard.Content>
                                <ItemCard.Title>{reminder.title}</ItemCard.Title>
                                <ItemCard.Description className="tabular-nums">
                                    {formatReminderFireAt(reminder.fireAt)}
                                    {reminder.repeat ? ` · ${reminder.repeat}` : ''}
                                </ItemCard.Description>
                            </ItemCard.Content>
                        </ItemCard>
                    </React.Fragment>
                ))
            )}
        </ProfileListSection>
    );
}

function formatReminderFireAt(value: Date | string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
