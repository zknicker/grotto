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
