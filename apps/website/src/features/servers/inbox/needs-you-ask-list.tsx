import { ListView } from '@heroui-pro/react';
import { BubbleChatQuestionIcon } from '@hugeicons-pro/core-stroke-rounded';
import { Icon } from '../../../components/ui/icon.tsx';
import { NeedsYouAskStep } from './needs-you-ask-step.tsx';
import type { NeedsYouAsk } from './needs-you-asks.ts';

/**
 * Open Asks addressed to the viewer. They lead the section because an Ask is a
 * decision only this human can make, where a Task in review is a look someone
 * else is waiting on.
 */
export function NeedsYouAskList({
    asks,
    onOpenAsk,
    serverId,
}: {
    asks: readonly NeedsYouAsk[];
    onOpenAsk: (messageId: string) => void;
    serverId: string;
}) {
    return (
        <ListView
            aria-label="Asks that need you"
            items={asks}
            onAction={(key) => onOpenAsk(String(key))}
            variant="secondary"
        >
            {(ask) => (
                <ListView.Item id={ask.id} textValue={ask.title}>
                    <ListView.ItemContent>
                        <Icon
                            className="size-4 shrink-0 text-muted"
                            icon={BubbleChatQuestionIcon}
                        />
                        <div className="flex min-w-0 flex-col">
                            <ListView.Title>{ask.title}</ListView.Title>
                            <ListView.Description>{ask.summary}</ListView.Description>
                            <ListView.Description>
                                {ask.chatLabel} · {ask.agentName}
                            </ListView.Description>
                        </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                        <NeedsYouAskStep ask={ask} serverId={serverId} />
                    </ListView.ItemAction>
                </ListView.Item>
            )}
        </ListView>
    );
}
