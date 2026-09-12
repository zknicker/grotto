import { Sidebar } from '@heroui-pro/react';
import { UnreadCountChip } from '../../components/chats/unread-count-chip.tsx';
import { HausGhost } from '../../components/haus-ghost.tsx';
import { useOptionalCurrentAgentActivity } from '../../hooks/agents/use-current-agent-activity.tsx';
import { inboxRoute } from '../servers/server-routes.ts';
import { resolveAgentActivityGhostTempo } from './agent-activity-ghost-tempo.ts';

/**
 * The sidebar's top-left anchor: Inbox, marked by the Haus ghost.
 *
 * The mark stands where a product's wordmark would and always wears the
 * app-icon mesh. Its drift speed is the Server's live-work tell: a slow
 * shimmer when the Server is quiet, noticeably quicker while any Agent works.
 *
 * The row leads the sidebar, offset by half the shared shell band so its
 * midline meets the content topbar's across the divider (`shell.css`) while the
 * menu's own pitch continues under it. Nothing shares its line: Settings moved
 * to the sidebar's footer.
 * `needsYouCount` badges it with the Inbox's own "Needs you" total, wearing the
 * same chip the Chat rows wear for unread messages and, like them, showing
 * nothing at zero. The chip sits at the row's natural trailing edge.
 *
 * It draws at a 22px identity-mark box inside HeroUI's narrower icon column,
 * the same overflow the DM avatars already take. The column centers it and does
 * not shrink, so the label keeps the exact x of Search and Tasks — which is why
 * this row carries none of the optical nudge the DM rows use.
 */
export function SidebarInboxRow({
    isCurrent,
    needsYouCount,
    onPreload,
    slug,
}: {
    isCurrent: boolean;
    needsYouCount: number;
    onPreload: () => void;
    slug: string;
}) {
    const tempo = resolveAgentActivityGhostTempo(useOptionalCurrentAgentActivity());

    return (
        <Sidebar.MenuItem
            href={inboxRoute(slug)}
            id="inbox"
            isCurrent={isCurrent}
            onHoverStart={onPreload}
            textValue="Inbox"
        >
            <Sidebar.MenuIcon>
                <HausGhost animated aria-hidden="true" fill="iridescent" size={22} tempo={tempo} />
            </Sidebar.MenuIcon>
            <Sidebar.MenuItemContent>
                <Sidebar.MenuLabel>Inbox</Sidebar.MenuLabel>
                {needsYouCount > 0 ? (
                    <UnreadCountChip
                        ariaLabel={`${needsYouCount} needs you`}
                        count={needsYouCount}
                    />
                ) : null}
            </Sidebar.MenuItemContent>
        </Sidebar.MenuItem>
    );
}
