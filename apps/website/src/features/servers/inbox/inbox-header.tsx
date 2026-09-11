import { useRelativeNow } from '../../../components/time/relative-time.tsx';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { useServerContext } from '../server-context.ts';
import { greetingLine, todayLabel } from './inbox-today.ts';

/**
 * The page's opening line: who is reading, and what day it is. It is the one
 * place the Inbox addresses the person rather than the work, so it is a line
 * and a date — no card around it, and no poster type.
 *
 * A greeting needs a name, so nothing renders until the member directory
 * lands. A bare "Good afternoon" addresses nobody, and a date that jumps down
 * a line when the name arrives is worse than a beat of blank.
 */
export function InboxHeader() {
    const { server } = useServerContext();
    const members = useMembers(server.id);
    const humans = useHumanDirectory(server.id);
    // The date only has to be right, not live; the minute tick is what keeps a
    // greeting from staying "Good morning" into the afternoon.
    const now = useRelativeNow(60_000);
    const viewerUserId = members.data?.viewerUserId ?? null;

    if (!viewerUserId) {
        return null;
    }

    return (
        <header className="flex flex-col gap-0.5">
            <h1 className="font-semibold text-foreground text-lg">
                {greetingLine(now, humans.name(viewerUserId))}
            </h1>
            <p className="text-muted text-sm">{todayLabel(now)}</p>
        </header>
    );
}
