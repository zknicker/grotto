/**
 * The assignment handoff is a private Agent-facing delivery, so it is typed
 * an inbox item rather than a Chat message: everything in `chat_messages` is
 * human-readable. The task message stays the canonical Chat work item; this
 * envelope only makes the direct handoff explicit to the assignee, and reads
 * like the other bodiless deliveries the Agent drains.
 */
export function taskAssignmentEnvelope(input: {
    /** The assigner's Server handle, or null when they have not claimed one. */
    assignedByHandle: string | null;
    number: number;
    target: string;
    title: string;
}): string {
    // A member without a Server handle has no name to attribute this to, and
    // inventing one would misreport who reassigned the task.
    const assignedBy = input.assignedByHandle ? ` assignedBy=@${input.assignedByHandle}` : '';
    const header = `[Grotto task assignment task=#${input.number} target=${input.target}${assignedBy}]`;
    return `${header} ${envelopeTitle(input.title)}`;
}

/** The stable delivery identity of one assignment: one row per task version. */
export function taskAssignmentKey(messageId: string, version: number): string {
    return `task-assign:${messageId}:${version}`;
}

function envelopeTitle(title: string): string {
    const flat = title.replaceAll(/\s+/gu, ' ').trim();
    return flat.length > 80 ? `${flat.slice(0, 77).trimEnd()}…` : flat;
}
