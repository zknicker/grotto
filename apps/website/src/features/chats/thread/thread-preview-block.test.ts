import { expect, test } from 'bun:test';
import { threadPreviewAuthorName, threadPreviewLine } from './thread-preview-block.tsx';

test('an unresolved Thread reply author is labeled honestly', () => {
    expect(threadPreviewAuthorName(null)).toBe('Unknown');
});

test('a resolved Thread reply author keeps their name', () => {
    expect(threadPreviewAuthorName({ name: 'Cindy' })).toBe('Cindy');
});

test('a Thread preview line shows reference labels instead of their targets', () => {
    expect(
        threadPreviewLine(
            'Ask [@Blippy](agent://agt_blippy) and [@Ada](user://usr_ada) about the [#product](chat://cht_sO6tOmR7_sqTzXwE) review'
        )
    ).toBe('Ask @Blippy and @Ada about the #product review');
});

test('a Thread preview line collapses a web link to its text', () => {
    expect(threadPreviewLine('See\n[the release notes](https://grotto.dev/releases)  now')).toBe(
        'See the release notes now'
    );
});
