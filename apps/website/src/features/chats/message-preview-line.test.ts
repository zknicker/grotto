import { expect, test } from 'bun:test';
import { messagePreviewLine } from './message-preview-line.ts';

test('a preview line shows reference labels instead of their targets', () => {
    expect(
        messagePreviewLine(
            'Ask [@Blippy](agent://agt_blippy) and [@Ada](user://usr_ada) about the [#product](chat://cht_sO6tOmR7_sqTzXwE) review'
        )
    ).toBe('Ask @Blippy and @Ada about the #product review');
});

test('a preview line collapses a web link to its text', () => {
    expect(messagePreviewLine('See\n[the release notes](https://grotto.dev/releases)  now')).toBe(
        'See the release notes now'
    );
});

test('a preview line drops the heading markers a Markdown report opens with', () => {
    expect(messagePreviewLine('## Summary\nFixed the stale wording in the README.')).toBe(
        'Summary Fixed the stale wording in the README.'
    );
    expect(messagePreviewLine('# Top\n### Deeper')).toBe('Top Deeper');
});

test('a preview line keeps a #channel reference, which is not a heading', () => {
    expect(messagePreviewLine('#product ships today')).toBe('#product ships today');
});

test('a preview line reads a bullet list as a sentence', () => {
    expect(messagePreviewLine('Did this:\n- Read the file\n* Fixed it\n  + Shipped it')).toBe(
        'Did this: Read the file Fixed it Shipped it'
    );
    // Only a bullet takes the space Markdown asks of it; a dash does not.
    expect(messagePreviewLine('Ran -5m behind')).toBe('Ran -5m behind');
});

test('a preview line drops emphasis and code markers', () => {
    expect(messagePreviewLine('**Fixed** the `README` and __shipped__ it')).toBe(
        'Fixed the README and shipped it'
    );
    expect(messagePreviewLine('Ran:\n```bash\nbun test\n```')).toBe('Ran: bash bun test');
});
