import type { ServerMember, ServerMemberDirectory } from '@tavern/api/hosted-membership';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
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
                    className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-muted/40"
                    data-member-id={member.userId}
                    key={member.userId}
                >
                    <div className="flex min-w-0 items-baseline gap-2">
                        <span className="text-foreground text-sm">{humanLabel(member.userId)}</span>
                        <Badge variant="secondary">{member.role}</Badge>
                        {member.userId === directory.viewerUserId ? (
                            <span className="text-muted-foreground text-xs">you</span>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {serverMemberRowActions(directory, member).map((action) => (
                            <Button
                                disabled={action.disabledReason !== null}
                                key={action.kind}
                                onClick={() => onChoose(member, action)}
                                size="xs"
                                title={action.disabledReason ?? undefined}
                                variant={actionVariant(action)}
                            >
                                {action.label}
                            </Button>
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
        return 'destructive-ghost' as const;
    }

    return action.requiresSlug ? ('outline' as const) : ('ghost' as const);
}
