import { ListView } from '@heroui-pro/react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import type { TaskItem } from '../tasks/task-model.ts';

/**
 * Claims whose Agent stopped before finishing. Chat hides an Agent's claims by
 * default, so this row is the only place a person learns that one was taken and
 * dropped: whose it was, what was asked, and the way into the task.
 */
export function NeedsYouStalledClaimList({
    claims,
    onOpenTask,
}: {
    claims: readonly TaskItem[];
    onOpenTask: (messageId: string) => void;
}) {
    return (
        <ListView
            aria-label="Claims an Agent stopped before finishing"
            items={claims}
            onAction={(key) => onOpenTask(String(key))}
            variant="secondary"
        >
            {(claim) => (
                <ListView.Item id={claim.id} textValue={stalledClaimTitle(claim)}>
                    <ListView.ItemContent>
                        <span className="shrink-0">
                            <EntityAvatar
                                name={claim.assigneeLabel}
                                size={20}
                                src={claim.assigneeAvatarUrl}
                            />
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <ListView.Title>{stalledClaimTitle(claim)}</ListView.Title>
                            <ListView.Description>{claim.title}</ListView.Description>
                            <ListView.Description>
                                {claim.chatLabel} · Task #{claim.number}
                            </ListView.Description>
                        </div>
                    </ListView.ItemContent>
                </ListView.Item>
            )}
        </ListView>
    );
}

export function stalledClaimTitle(claim: Pick<TaskItem, 'assigneeLabel'>) {
    return `${claim.assigneeLabel} stopped before finishing`;
}
