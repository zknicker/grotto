import type { Agent } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import { InboxIdentityMark, InboxRowText } from './inbox-row.tsx';
import { NeedsYouAskStep } from './needs-you-ask-step.tsx';
import type { NeedsYouRow } from './needs-you-rows.ts';

/**
 * Everything waiting on this human, as one list. Every row is the same shape —
 * the Agent behind it, what it is, the one line that says why, and where it
 * came from — so the eye can run down the column instead of re-reading each
 * row's layout.
 */
export function NeedsYouList({
    agentById,
    onOpenRow,
    rows,
    serverId,
}: {
    agentById: ReadonlyMap<string, Agent>;
    onOpenRow: (row: NeedsYouRow) => void;
    rows: readonly NeedsYouRow[];
    serverId: string;
}) {
    return (
        <ListView
            aria-label="What needs you"
            className="list-view--inbox"
            items={rows}
            onAction={(key) => {
                const row = rows.find((candidate) => candidate.id === String(key));
                if (row) {
                    onOpenRow(row);
                }
            }}
            variant="secondary"
        >
            {(row) => (
                <ListView.Item id={row.id} textValue={row.title}>
                    <ListView.ItemContent>
                        <InboxIdentityMark
                            agent={(row.agentId && agentById.get(row.agentId)) || null}
                            avatarUrl={row.avatarUrl}
                            name={row.markName}
                        />
                        <InboxRowText>
                            <ListView.Title>{row.title}</ListView.Title>
                            <ListView.Description>{row.substance}</ListView.Description>
                            <ListView.Description>{row.meta}</ListView.Description>
                        </InboxRowText>
                    </ListView.ItemContent>
                    {row.kind === 'ask' ? (
                        <ListView.ItemAction>
                            <NeedsYouAskStep ask={row.ask} serverId={serverId} />
                        </ListView.ItemAction>
                    ) : null}
                </ListView.Item>
            )}
        </ListView>
    );
}
