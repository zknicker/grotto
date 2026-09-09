import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgents } from '../../../hooks/members/use-agents.ts';
import { useHumanDirectory } from '../../../hooks/servers/use-human-directory.ts';
import { useMembers } from '../../../hooks/servers/use-members.ts';
import { useOpenAsks } from '../../../hooks/servers/use-open-asks.ts';
import { useTasks } from '../../../hooks/servers/use-tasks.ts';
import { useServerContext } from '../server-context.ts';
import { tasksRoute } from '../server-routes.ts';
import { toTaskItem } from '../tasks/task-model.ts';
import { InboxSection, InboxSectionEmpty, InboxSectionPending } from './inbox-section.tsx';
import { useInboxView } from './inbox-view.ts';
import { NeedsYouAskList } from './needs-you-ask-list.tsx';
import { toNeedsYouAsks } from './needs-you-asks.ts';
import { NeedsYouStalledClaimList } from './needs-you-stalled-claim-list.tsx';
import { NeedsYouTaskList } from './needs-you-task-list.tsx';
import { selectNeedsYouTasks } from './needs-you-tasks.ts';
import { selectStalledClaims } from './stalled-claims.ts';

/**
 * Work waiting on this human: open Asks addressed to them, then claims an
 * Agent took and stopped short of finishing, then Tasks in review that they
 * own. Pending Agent creation proposals join it once the Server can list them.
 *
 * The stalled claims read the same default lens the Board does: a claim whose
 * run settled unfinished is stamped tracked by then, so widening past the
 * background tier would only fetch rows this section discards.
 */
export function InboxNeedsYou() {
    const { server } = useServerContext();
    const navigate = useNavigate();
    const { openAsk } = useInboxView();
    const asks = useOpenAsks(server.id);
    const tasks = useTasks(server.id);
    const members = useMembers(server.id);
    const humans = useHumanDirectory(server.id);
    const agents = useAgents(server.id);
    const viewerUserId = members.data?.viewerUserId ?? null;
    const askRows = React.useMemo(
        () => toNeedsYouAsks(asks.data ?? [], humans, agents.data ?? []),
        [agents.data, asks.data, humans]
    );
    const taskItems = React.useMemo(
        () => (tasks.data?.tasks ?? []).map((item) => toTaskItem(item, humans, agents.data ?? [])),
        [agents.data, humans, tasks.data]
    );
    const stalledClaims = React.useMemo(() => selectStalledClaims(taskItems), [taskItems]);
    const taskRows = React.useMemo(
        () => selectNeedsYouTasks(taskItems, viewerUserId),
        [taskItems, viewerUserId]
    );
    const openTask = (messageId: string) =>
        navigate(`${tasksRoute(server.slug)}?task=${encodeURIComponent(messageId)}`);
    // Both reads are the same claim — that nothing needs you — so the section
    // stays neutral until both have settled rather than emptying, then filling.
    const settled = Boolean(asks.data && tasks.data && members.data);

    return (
        <InboxSection title="Needs you">
            {settled ? (
                askRows.length === 0 && stalledClaims.length === 0 && taskRows.length === 0 ? (
                    <InboxSectionEmpty description="Nothing needs you." />
                ) : (
                    <>
                        {askRows.length > 0 ? (
                            <NeedsYouAskList
                                asks={askRows}
                                onOpenAsk={openAsk}
                                serverId={server.id}
                            />
                        ) : null}
                        {stalledClaims.length > 0 ? (
                            <NeedsYouStalledClaimList
                                claims={stalledClaims}
                                onOpenTask={openTask}
                            />
                        ) : null}
                        {taskRows.length > 0 ? (
                            <NeedsYouTaskList onOpenTask={openTask} tasks={taskRows} />
                        ) : null}
                    </>
                )
            ) : (
                <InboxSectionPending label="Loading what needs you" />
            )}
        </InboxSection>
    );
}
