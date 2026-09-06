import { expect, test } from 'vitest';
import { truncate } from './format.ts';

test('truncates string exceeding max length with ellipsis', () => {
    expect(truncate('Hello, World!', 10)).toBe('Hello, Wo…');
});
