/**
 * The assignment receipt is a private Agent-facing communication. The task
 * message remains the canonical Chat work item; this copy only makes the
 * direct handoff explicit to the assignee, matching Raft's task notice.
 */
export function taskAssignmentReceiptContent(input: {
    assigneeHandle: string;
    number: number;
    title: string;
}): string {
    return `📌 Assigned @${input.assigneeHandle} to task #${input.number} "${receiptTitle(input.title)}"`;
}

function receiptTitle(title: string): string {
    const flat = title.replaceAll(/\s+/gu, ' ').trim();
    return flat.length > 80 ? `${flat.slice(0, 77).trimEnd()}…` : flat;
}
