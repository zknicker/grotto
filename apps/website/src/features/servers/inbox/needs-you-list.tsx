import type { Agent } from '@grotto/api';
import { ListView } from '@heroui-pro/react';
import {
    InboxIdentityMark,
    InboxRowLine,
    InboxRowMeta,
    InboxRowPreview,
    InboxRowTitle,
} from './inbox-row.tsx';
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
                        <InboxRowLine>
                            <InboxRowTitle>{row.title}</InboxRowTitle>
                            <InboxRowPreview>{row.preview}</InboxRowPreview>
                        </InboxRowLine>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                        <InboxRowMeta>
                            <span>{row.meta}</span>
                            {row.kind === 'ask' ? (
                                <NeedsYouAskStep ask={row.ask} serverId={serverId} />
                            ) : null}
                        </InboxRowMeta>
                    </ListView.ItemAction>
                </ListView.Item>
            )}
        </ListView>
    );
}
