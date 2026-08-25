import { describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    deliverableNames,
    readRenderedEnvironmentNames,
    readSchemaItems,
} from './lib/env-schema.ts';
import { serverEnvironmentNames, shellQuote } from './render-server-env.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const schemaItems = readSchemaItems(join(repositoryRoot, '.env.schema'));

describe('the delivered Server environment', () => {
    test('names every value the Server validates, and nothing else', () => {
        const names = serverEnvironmentNames();
        const deliverable = deliverableNames(schemaItems);

        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            expect(deliverable.has(name)).toBe(true);
        }
        // The migration credential is the deploy job's alone; delivering it to
        // the running Server would hand it schema-owner rights on its own
        // database.
        expect(names).not.toContain('GROTTO_DATABASE_MIGRATION_URL');
        expect(names).not.toContain('GROTTO_POSTGRES_ADMIN_PASSWORD');
    });

    test('survives shell sourcing of a value with quotes and a dollar sign', () => {
        const value = 'p\'a$$w"ord';
        const file = join(mkdtempSync(join(tmpdir(), 'grotto-render-')), 'server.env');
        writeFileSync(file, `GROTTO_DATABASE_URL=${shellQuote(value)}\n`);

        const read = Bun.spawnSync([
            '/bin/sh',
            '-c',
            `set -a; . "$1"; printf '%s' "$GROTTO_DATABASE_URL"`,
            'sh',
            file,
        ]);

        expect(read.stdout.toString()).toBe(value);
        expect(readRenderedEnvironmentNames(file)).toEqual(['GROTTO_DATABASE_URL']);
    });

    test('no @internal item can ever be delivered', () => {
        const deliverable = deliverableNames(schemaItems);
        for (const item of schemaItems.filter((candidate) => candidate.isInternal)) {
            expect(deliverable.has(item.name)).toBe(false);
        }
    });
});
