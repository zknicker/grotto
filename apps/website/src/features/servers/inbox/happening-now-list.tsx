import { ListView } from '@heroui-pro/react';
import { CloudAgentProviderGlyph } from '../../cloud-agents/cloud-agent-provider-mark.tsx';
import { CloudAgentStatusDisc } from '../../cloud-agents/cloud-agent-status-disc.tsx';
import type { HappeningNowRow } from './happening-now-rows.ts';
import { InboxGlyphMark, InboxIdentityMark, InboxRowText } from './inbox-row.tsx';

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
                            <InboxRowText>
                                <ListView.Title>{row.work.title}</ListView.Title>
                                <ListView.Description>
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <CloudAgentStatusDisc
                                            className="size-3.5"
                                            status={row.work.status}
                                        />
                                        {row.work.statusText}
                                    </span>
                                </ListView.Description>
                                <ListView.Description>
                                    {row.work.chatLabel} · {row.work.agentName}
                                </ListView.Description>
                            </InboxRowText>
                        </ListView.ItemContent>
                    </ListView.Item>
                ) : (
                    <ListView.Item id={row.id} textValue={row.agent.name}>
                        <ListView.ItemContent>
                            <InboxIdentityMark agent={row.agent.agent} name={row.agent.name} />
                            <InboxRowText>
                                <ListView.Title>{row.agent.name}</ListView.Title>
                                <ListView.Description>{row.agent.label}</ListView.Description>
                            </InboxRowText>
                        </ListView.ItemContent>
                    </ListView.Item>
                )
            }
        </ListView>
    );
}
