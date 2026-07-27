import type { PendingWorkRow } from './store.ts';

/**
 * Composes one drain prompt from the pending inbox rows a run claimed. Each unit
 * becomes one envelope line, oldest first, followed by the standing instruction
 * that the CLI is the only reply channel. The full inbox drain shape lives in
 * specs/inbox.md; this is the hosted slice.
 */
export function composeDrainPrompt(work: PendingWorkRow[]): string {
    return [
        '--- New messages ---',
        ...work.map((item) => `[target=dm type=${item.source}] ${item.content}`),
        '',
        'Reply to the human by running `grotto message send`.',
    ].join('\n');
}
