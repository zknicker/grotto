import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const serverSourceRoot = join(import.meta.dir, '..');

/**
 * PRECONDITION_FAILED is the App's one typed "update required" signal
 * (apps/website/src/lib/app-update-required.ts): any procedure that throws it
 * puts the whole App behind the full-screen update gate. Only the protocol
 * check in grotto-api/trpc.ts may use it — an avatar procedure reusing the
 * code once turned "generation is not configured" into "reload Grotto".
 */
test('only the protocol gate throws PRECONDITION_FAILED', () => {
    const offenders = sourceFiles(serverSourceRoot)
        .filter((file) => readFileSync(file, 'utf8').includes('PRECONDITION_FAILED'))
        .map((file) => file.slice(serverSourceRoot.length + 1))
        .filter((file) => file !== 'grotto-api/trpc.ts');

    expect(offenders).toEqual([]);
});

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter(
            (entry) =>
                entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
        )
        .map((entry) => join(entry.parentPath, entry.name));
}
