import { expect, test } from 'bun:test';
import { resolveChatComposerPlaceholder } from './chat-composer-presentation.ts';

test('names the current channel or Agent in the default composer placeholder', () => {
    expect(resolveChatComposerPlaceholder('product')).toBe('Message product');
    expect(resolveChatComposerPlaceholder('Blippy')).toBe('Message Blippy');
});

test('preserves purpose-specific composer copy', () => {
    expect(resolveChatComposerPlaceholder('product', 'Add a reply…')).toBe('Add a reply…');
});
