import { Button, Chip } from '@heroui/react';
import type { ServerMember, ServerMemberDirectory } from '@tavern/api/hosted-membership';
import {
    humanLabel,
    type ServerMemberRowAction,
    serverMemberRowActions,
} from './server-member-actions.ts';

/**
 * The humans on one Server. Rows render from the directory the Server returned,
 * including the viewer's own role, so an affordance can never disagree with the
 * Server that judges it.
 */
export function ServerMemberList({
    directory,
    onChoose,
}: {
    directory: ServerMemberDirectory;
    onChoose(member: ServerMember, action: ServerMemberRowAction): void;
}) {
    return (
        <ul className="flex flex-col gap-1">
            {directory.members.map((member) => (
                <li
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-surface-secondary"
                    data-member-id={member.userId}
                    key={member.userId}
                >
                    <div className="flex min-w-0 items-baseline gap-2">
                        <span className="text-foreground text-sm">{humanLabel(member.userId)}</span>
                        <Chip size="sm" variant="secondary">
                            {member.role}
                        </Chip>
                        {member.userId === directory.viewerUserId ? (
                            <span className="text-muted text-xs">you</span>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {serverMemberRowActions(directory, member).map((action) => (
                            // A disabled button receives no pointer events, so a
                            // Tooltip on it would never open. The reason the
                            // Server refuses the action hangs off the wrapper.
                            <span key={action.kind} title={action.disabledReason ?? undefined}>
                                <Button
                                    isDisabled={action.disabledReason !== null}
                                    onPress={() => onChoose(member, action)}
                                    size="sm"
                                    variant={actionVariant(action)}
                                >
                                    {action.label}
                                </Button>
                            </span>
                        ))}
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Departures read as destructive; Owner-level changes read as deliberate. */
function actionVariant(action: ServerMemberRowAction) {
    if (action.kind === 'leave' || action.kind === 'remove') {
        return 'danger-soft' as const;
    }

    return action.requiresSlug ? ('outline' as const) : ('ghost' as const);
}
