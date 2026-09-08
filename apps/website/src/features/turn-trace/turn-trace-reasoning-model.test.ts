import assert from 'node:assert/strict';
import test from 'node:test';
import {
    readReasoningDurationMs,
    readReasoningPresentation,
    readReasoningTitle,
} from './turn-trace-reasoning-model.ts';

function presentation(text: string, durationMs: number | null, isStreaming = false) {
    return readReasoningPresentation({
        duration: durationMs === null ? null : `${durationMs}ms`,
        durationMs,
        isStreaming,
        text,
    });
}

test('a bold first line becomes the trigger and its body is what remains', () => {
    const result = presentation(
        '**Planning separate create and edit operations**\n\nI will write the file first.',
        0
    );

    assert.equal(result.label, 'Planning separate create and edit operations');
    assert.equal(result.body, 'I will write the file first.');
    assert.equal(result.formatted, true);
});

test('a markdown heading is stripped to its phrase', () => {
    const result = presentation('## Reading the workspace\nThen listing it.', 4);

    assert.equal(result.label, 'Reading the workspace');
    assert.equal(result.body, 'Then listing it.');
});

test('a title with nothing under it stays as the body, unformatted', () => {
    const result = presentation('**Checking the inbox**', 0);

    assert.equal(result.label, 'Checking the inbox');
    assert.equal(result.body, 'Checking the inbox');
    assert.equal(result.formatted, false);
});

test('a long title is capped with an ellipsis', () => {
    const title = readReasoningTitle(`**${'word '.repeat(30).trim()}**`);

    assert.ok(title);
    assert.equal(title.length, 72);
    assert.ok(title.endsWith('…'));
});

test('a line carrying two bold runs is prose, not a title', () => {
    assert.equal(readReasoningTitle('**one** and **two**'), null);
    assert.equal(readReasoningTitle('Plain prose about the plan.'), null);
});

test('only a thought worth a second reports its duration', () => {
    assert.equal(presentation('Weighing the options.', 0).label, 'Thought');
    assert.equal(presentation('Weighing the options.', 999).label, 'Thought');
    assert.equal(presentation('Weighing the options.', 1200).label, 'Thought for 1200ms');
    assert.equal(presentation('Weighing the options.', null).label, 'Thought');
});

test('a running block says it is still thinking and keeps its whole text', () => {
    const result = presentation('**Planning**\n\nStill going.', null, true);

    assert.equal(result.label, 'Thinking…');
    assert.equal(result.body, '**Planning**\n\nStill going.');
});

test('duration is null until a block ends', () => {
    assert.equal(readReasoningDurationMs('2026-09-08T11:29:00.000Z', null), null);
    assert.equal(readReasoningDurationMs('nonsense', '2026-09-08T11:29:00.000Z'), null);
    assert.equal(
        readReasoningDurationMs('2026-09-08T11:29:00.000Z', '2026-09-08T11:29:02.500Z'),
        2500
    );
});
