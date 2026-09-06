import { expect, test } from 'bun:test';
import { normalizeWorkspacePath } from './workspace-file-paths.ts';

test('normalizes workspace path with forward slashes', () => {
	expect(normalizeWorkspacePath('src/components/button.tsx', false)).toBe(
		'src/components/button.tsx'
	);
});
