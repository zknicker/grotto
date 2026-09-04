import type { TaskStatus } from '../../tasks/task-presentation.ts';

/** The only Task fields the Inbox's "Needs you" question depends on. */
export interface NeedsYouTask {
    assigneeUserId: null | string;
    createdByUserId: null | string;
    status: TaskStatus;
}

/**
 * A Task needs this human when it is waiting on review and it is theirs — they
 * filed it, or it is reserved for them. Review is the one status where the work
 * has stopped until a person looks; every other status is somebody else's turn.
 */
export function selectNeedsYouTasks<TTask extends NeedsYouTask>(
    items: readonly TTask[],
    viewerUserId: null | string
): TTask[] {
    if (!viewerUserId) {
        return [];
    }

    return items.filter(
        (item) =>
            item.status === 'in_review' &&
            (item.createdByUserId === viewerUserId || item.assigneeUserId === viewerUserId)
    );
}
