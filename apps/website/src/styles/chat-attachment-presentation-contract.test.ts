import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const themeCss = readFileSync(join(import.meta.dir, 'default-theme.css'), 'utf8');

test('transcript images override the compact attachment tile at the theme boundary', () => {
    const selector = '.chat-attachment.chat-attachment--transcript-image';
    const start = themeCss.lastIndexOf(selector);
    expect(start).toBeGreaterThan(-1);
    const block = themeCss.slice(start, themeCss.indexOf('}', start)).replace(/\s+/gu, ' ');

    expect(block).toContain('height: auto');
    expect(block).toContain('aspect-ratio: 1');
    expect(themeCss).toContain(
        '.chat-attachment-trigger,\n    .chat-attachment.chat-attachment--transcript-image {\n        width: min(100%, calc(var(--spacing) * 20));'
    );
});
