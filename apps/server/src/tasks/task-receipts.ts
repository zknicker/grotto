export interface TaskReceiptTask {
    number: number;
    title: string;
}

export function taskReceiptContent(input: {
    actorLabel?: string;
    kind: 'converted' | 'created';
    tasks: TaskReceiptTask[];
}): string | null {
    const first = input.tasks[0];
    if (!first) {
        return null;
    }

    if (input.kind === 'converted') {
        const actor = input.actorLabel ?? 'Operator';
        return `📋 ${actor} converted a message to task #${first.number} "${receiptTitle(first.title)}"`;
    }

    const refs = input.tasks
        .map((task) => `#${task.number} "${receiptTitle(task.title)}"`)
        .join(', ');
    const noun = input.tasks.length === 1 ? 'task' : 'tasks';
    return `📋 ${input.tasks.length} new ${noun} created: ${refs}`;
}

function receiptTitle(title: string): string {
    const flat = title.replaceAll(/\s+/gu, ' ').trim();
    return flat.length > 40 ? `${flat.slice(0, 27).trimEnd()}…` : flat;
}
