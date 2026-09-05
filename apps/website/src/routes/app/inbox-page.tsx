import { AskThreadDialog } from '../../features/servers/inbox/ask-thread-dialog.tsx';
import { InboxHappeningNow } from '../../features/servers/inbox/inbox-happening-now.tsx';
import { InboxNeedsYou } from '../../features/servers/inbox/inbox-needs-you.tsx';
import { InboxWhileYouWereAway } from '../../features/servers/inbox/inbox-while-you-were-away.tsx';
import { PageColumn } from '../../features/shell/page-column.tsx';
import { SectionHeader } from '../../features/shell/section-header.tsx';
import { PageTopbar } from '../../features/shell/shell-topbar.tsx';
import { useWindowTitle } from '../../hooks/shell/use-window-title.ts';

/**
 * The human Inbox: a lens over records that already exist elsewhere. It owns
 * no state, creates nothing, and rides the invalidations its sources already
 * emit. Each section reads its own query and states its own result.
 */
export function InboxPage() {
    useWindowTitle('Inbox');

    return (
        <>
            <PageTopbar>
                <SectionHeader title="Inbox" />
            </PageTopbar>
            <PageColumn>
                <InboxNeedsYou />
                <InboxHappeningNow />
                <InboxWhileYouWereAway />
            </PageColumn>
            <AskThreadDialog />
        </>
    );
}
