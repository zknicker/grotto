import { ListView } from '@heroui-pro/react';
import { CloudAgentProviderGlyph } from '../../cloud-agents/cloud-agent-provider-mark.tsx';
import { CloudAgentStatusDisc } from '../../cloud-agents/cloud-agent-status-disc.tsx';
import type { HappeningNowRow } from './happening-now-rows.ts';
import {
    InboxGlyphMark,
    InboxIdentityMark,
    InboxRowLine,
    InboxRowMeta,
    InboxRowPreview,
    InboxRowTitle,
} from './inbox-row.tsx';

/**
 * What is moving right now, as one list: the Cloud Agent work a delegation
 * left running, then the Agents currently in a turn. Both rows state elapsed
 * time, which is what separates working from stuck.
 */
export function HappeningNowList({
    onOpenRow,
    rows,
}: {
    onOpenRow: (row: HappeningNowRow) => void;
    rows: readonly HappeningNowRow[];
}) {
    return (
        <ListView
            aria-label="Work running now"
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
            {(row) =>
                row.kind === 'work' ? (
                    <ListView.Item id={row.id} textValue={row.work.title}>
                        <ListView.ItemContent>
                            <InboxGlyphMark>
                                <CloudAgentProviderGlyph provider={row.work.provider} />
                            </InboxGlyphMark>
                            <InboxRowLine>
                                <InboxRowTitle>{row.work.title}</InboxRowTitle>
                                <InboxRowPreview>
                                    {row.work.chatLabel} · {row.work.agentName}
                                </InboxRowPreview>
                            </InboxRowLine>
                        </ListView.ItemContent>
                        {/* Status is the row's meta, not its preview: it is the
                            fact that changes while the row sits there, so it
                            keeps the fixed trailing column rather than
                            competing with the Chat it came from. */}
                        <ListView.ItemAction>
                            <InboxRowMeta>
                                <CloudAgentStatusDisc
                                    className="size-3.5"
                                    status={row.work.status}
                                />
                                <span>{row.work.statusText}</span>
                            </InboxRowMeta>
                        </ListView.ItemAction>
                    </ListView.Item>
                ) : (
                    <ListView.Item id={row.id} textValue={row.agent.name}>
                        <ListView.ItemContent>
                            <InboxIdentityMark agent={row.agent.agent} name={row.agent.name} />
                            <InboxRowLine>
                                <InboxRowTitle>{row.agent.name}</InboxRowTitle>
                                <InboxRowPreview>{row.agent.label}</InboxRowPreview>
                            </InboxRowLine>
                        </ListView.ItemContent>
                    </ListView.Item>
                )
            }
        </ListView>
    );
}
