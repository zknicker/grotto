import { ListView } from '@heroui-pro/react';
import { CloudAgentProviderGlyph } from '../../cloud-agents/cloud-agent-provider-mark.tsx';
import { CloudAgentStatusDisc } from '../../cloud-agents/cloud-agent-status-disc.tsx';
import type { HappeningNowWork } from './happening-now-work.ts';

/**
 * Cloud Agent work running right now. It leads the section because this work
 * outlives the turn that started it: an Agent below may be between turns while
 * its delegated work keeps going.
 */
export function HappeningNowWorkList({
    onOpenWork,
    work,
}: {
    onOpenWork: (messageId: string) => void;
    work: readonly HappeningNowWork[];
}) {
    return (
        <ListView
            aria-label="Cloud Agent work running now"
            items={work}
            onAction={(key) => onOpenWork(String(key))}
            variant="secondary"
        >
            {(item) => (
                <ListView.Item id={item.id} textValue={item.title}>
                    <ListView.ItemContent>
                        <CloudAgentProviderGlyph provider={item.provider} />
                        <div className="flex min-w-0 flex-col">
                            <ListView.Title>{item.title}</ListView.Title>
                            <ListView.Description>
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <CloudAgentStatusDisc
                                        className="size-3.5"
                                        status={item.status}
                                    />
                                    {item.statusText}
                                </span>
                            </ListView.Description>
                            <ListView.Description>
                                {item.chatLabel} · {item.agentName}
                            </ListView.Description>
                        </div>
                    </ListView.ItemContent>
                </ListView.Item>
            )}
        </ListView>
    );
}
