import { expect, test } from 'bun:test';
import { threadPreviewAuthorName } from './thread-preview-block.tsx';

test('an unresolved Thread reply author is labeled honestly', () => {
    expect(threadPreviewAuthorName(null)).toBe('Unknown');
});

test('a resolved Thread reply author keeps their name', () => {
    expect(threadPreviewAuthorName({ name: 'Cindy' })).toBe('Cindy');
});
