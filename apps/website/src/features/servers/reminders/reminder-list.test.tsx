import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReminderItems } from './reminder-list.tsx';

test('renders redacted hosted state and only scheduled cancellation actions', () => {
    const markup = renderToStaticMarkup(
        <ReminderItems
            items={[
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
            onCancel={() => undefined}
            onOpenRuns={() => undefined}
        />
    );

    expect(markup).toContain('Script · 12 bytes · local execution only');
    expect(markup.match(/Cancel Reminder/g)).toHaveLength(1);
    expect(markup).not.toContain('touch ');
});
