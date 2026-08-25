import { expect, test } from 'vitest';
import { composerEditorHeightIsMultiline } from './use-compact-composer-layout.ts';

test('composer expands only when editor content exceeds one line', () => {
    expect(composerEditorHeightIsMultiline({ height: 20, lineHeight: 20 })).toBe(false);
    expect(composerEditorHeightIsMultiline({ height: 28, lineHeight: 20 })).toBe(false);
    expect(composerEditorHeightIsMultiline({ height: 30, lineHeight: 20 })).toBe(false);
    expect(composerEditorHeightIsMultiline({ height: 40, lineHeight: 20 })).toBe(true);
});
