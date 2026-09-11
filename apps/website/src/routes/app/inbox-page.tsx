import { CloudAgentWorkDialog } from '../../features/cloud-agents/cloud-agent-work-dialog.tsx';
import { AskThreadDialog } from '../../features/servers/inbox/ask-thread-dialog.tsx';
import { InboxActiveAgents } from '../../features/servers/inbox/inbox-active-agents.tsx';
import { InboxConversations } from '../../features/servers/inbox/inbox-conversations.tsx';
import { InboxHappeningNow } from '../../features/servers/inbox/inbox-happening-now.tsx';
import { InboxHeader } from '../../features/servers/inbox/inbox-header.tsx';
import { InboxNeedsYou } from '../../features/servers/inbox/inbox-needs-you.tsx';
import { PageColumn } from '../../features/shell/page-column.tsx';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/**
 * The human Inbox: a lens over records that already exist elsewhere. It owns
 * no state, creates nothing, and rides the invalidations its sources already
 * emit. Each section reads its own query and states its own result.
 *
 * The order is the reading order: who is reading and what day it is, then the
 * Agents that moved this week, then what is waiting on this person.
 *
 * Below the strip the page splits. Every section is content-height, and a
 * single column of them down a 1152px page is a ribbon of rows in a field of
 * white — the sections are narrow things, not wide ones. Two columns give the
 * width something to hold: the reader's own queue on the left, and what is
 * moving without them beside it. Below `lg` there is no width to divide, so it
 * falls back to the one column it always was.
 */
export function InboxPage() {
    useWindowTitle('Inbox');

    return (
        <>
            <PageTopbar>
                <SectionHeader title="Inbox" />
            </PageTopbar>
            <PageColumn>
                <InboxHeader />
                <InboxActiveAgents />
                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="flex flex-col gap-8">
                        <InboxNeedsYou />
                        <InboxConversations />
                    </div>
                    <InboxHappeningNow />
                </div>
            </PageColumn>
            <AskThreadDialog />
            <CloudAgentWorkDialog />
        </>
    );
}
