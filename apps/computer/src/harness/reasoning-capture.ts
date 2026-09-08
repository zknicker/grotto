import type { ComputerExecutionJournal } from './execution-journal.ts';

/**
 * Captures model reasoning into the Computer-local execution journal.
 *
 * The translated stream reports reasoning as `reasoning-start` / `reasoning-delta`
 * / `reasoning-end` triples keyed by a block `id`, with the delta text on `text`.
 * Deltas only mutate the in-memory document; the journal persists them when a
 * block ends, when a tool boundary writes, or when the turn finishes.
 */
export async function observeReasoningPart(
    part: Record<string, unknown>,
    journal: ComputerExecutionJournal | undefined
): Promise<void> {
    const id = typeof part.id === 'string' && part.id.length > 0 ? part.id : undefined;
    if (!(journal && id)) {
        return;
    }
    if (part.type === 'reasoning-start') {
        journal.recordReasoningStart({ id });
        return;
    }
    if (part.type === 'reasoning-delta') {
        if (typeof part.text === 'string') {
            journal.appendReasoning({ id, text: part.text });
        }
        return;
    }
    if (part.type === 'reasoning-end') {
        await journal.recordReasoningEnd({ id });
    }
}
