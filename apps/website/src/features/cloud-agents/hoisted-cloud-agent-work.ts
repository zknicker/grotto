import {
    type ActiveCloudAgentWork,
    activeCloudAgentWorkThreadAnchor,
    type CloudAgentWork,
} from '@grotto/api';

/**
 * Live Cloud Agent work by the Message whose Thread it runs inside.
 *
 * A Chat transcript carries its Threads only as reply previews — author, text,
 * and time — so the parent has no way to see that one of those replies
 * delegated work. This index is the read that supplies it, from the same
 * active-work list the Inbox already keeps warm. Terminal work is absent from
 * that list by construction, which is exactly the hoist rule: a finished run is
 * a fact for the Thread, not a status on the Chat.
 *
 * Work whose own Message anchors the Thread is skipped: that Message already
 * states itself in its surface header, and hoisting it would say it twice.
 */
export function indexCloudAgentWorkByThreadAnchor(
    rows: readonly ActiveCloudAgentWork[] | undefined
): ReadonlyMap<string, CloudAgentWork> {
    const byAnchor = new Map<string, CloudAgentWork>();

    for (const row of rows ?? []) {
        const anchorId = activeCloudAgentWorkThreadAnchor(row).id;

        // Oldest first, and the first live work under an anchor is the one the
        // surface states: a second concurrent run is legible in the Thread.
        if (anchorId !== row.work.messageId && !byAnchor.has(anchorId)) {
            byAnchor.set(anchorId, row.work);
        }
    }

    return byAnchor;
}
