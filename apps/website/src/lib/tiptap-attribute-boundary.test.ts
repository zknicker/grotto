import { expect, test } from 'bun:test';
import { mergeAttributes } from '@tiptap/core';

test('Tiptap does not inherit DOM attributes from a JSON prototype key', () => {
    const imported = JSON.parse('{"__proto__":{"data-inherited-canary":"unsafe"},"title":"safe"}');
    const attributes = mergeAttributes(imported);
    expect(Object.getPrototypeOf(attributes)).toBe(Object.prototype);
    expect(attributes['data-inherited-canary']).toBeUndefined();
    expect(attributes.title).toBe('safe');
});
