import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServerRemindersView } from './server-reminders-view.tsx';

test('renders redacted hosted state and only scheduled cancellation actions', () => {
    const markup = renderToStaticMarkup(
        <ServerRemindersView
            actionErrorMessage={null}
            activeCancelId={null}
            agentId={null}
            agents={[
                { character: 'owl' as const, id: 'agt_cove', name: 'Cove', primaryColor: null },
            ]}
            connectionState="connected"
            isPending={false}
            onAgentChange={() => undefined}
            onCancel={() => undefined}
            onCloseRuns={() => undefined}
            onOpenRuns={() => undefined}
            onQueryChange={() => undefined}
            onStatusChange={() => undefined}
            query=""
            reminders={[
                {
                    anchorChatId: 'cht_all',
                    fireAt: '2026-07-27T13:00:00.000Z',
                    id: 'rem_scheduled',
                    isScript: true,
                    ownerAgentId: 'agt_cove',
                    ownerLabel: '@Cove',
                    repeat: 'daily@09:00',
                    schedule: 'daily@09:00 · next Jul 27, 9:00 AM',
                    scriptLabel: 'Script · 12 bytes · local execution only',
                    status: 'scheduled',
                    title: 'Local watchdog',
                    version: 1,
                },
                {
                    anchorChatId: 'cht_all',
                    fireAt: '2026-07-26T13:00:00.000Z',
                    id: 'rem_canceled',
                    isScript: false,
                    ownerAgentId: 'agt_cove',
                    ownerLabel: '@Cove',
                    repeat: null,
                    schedule: 'Fires Jul 26, 9:00 AM',
                    scriptLabel: null,
                    status: 'canceled',
                    title: 'Old reminder',
                    version: 2,
                },
            ]}
            runs={[]}
            runsPending={false}
            selectedReminder={null}
            status="all"
        />
    );

    // Connected state shows no reconnect note; the filters render instead.
    expect(markup).not.toContain('Reconnecting');
    expect(markup).toContain('All Agents');
    expect(markup).toContain('Script · 12 bytes · local execution only');
    expect(markup.match(/Cancel reminder/g)).toHaveLength(1);
    expect(markup).not.toContain('touch ');
});
