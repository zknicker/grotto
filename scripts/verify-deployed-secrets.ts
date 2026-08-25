#!/usr/bin/env bun
/**
 * Post-deploy guard over the delivered runtime copy.
 *
 * Reads back the `config/server.env` the deploy job rendered and compares its
 * NAMES against `.env.schema`. Never reads a value, never contacts 1Password.
 *
 * Two failures it exists to catch: a name the platform still delivers that the
 * schema no longer declares (stale delivery outliving a rename), and a
 * production-required sensitive item missing from delivery (a Server about to
 * boot without a credential it needs).
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRenderedEnvironmentNames, readSchemaItems } from './lib/env-schema.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultTarget = '/Users/zknicker/srv/grotto/config/server.env';

function main() {
    const target = process.argv[2] ?? defaultTarget;
    const items = readSchemaItems(join(repositoryRoot, '.env.schema'));
    const delivered = new Set(readRenderedEnvironmentNames(target));
    const byName = new Map(items.map((item) => [item.name, item]));

    const issues: string[] = [];

    for (const name of [...delivered].sort()) {
        const item = byName.get(name);
        if (!item) {
            issues.push(`${name} is delivered to the Server but .env.schema does not declare it.`);
            continue;
        }
        if (item.isInternal) {
            issues.push(
                `${name} is @internal but reached the delivered environment; machinery credentials must never be delivered.`
            );
        }
    }

    for (const item of items) {
        if (item.isInternal || !(item.isSensitive && item.isRequiredInProduction)) {
            continue;
        }
        if (!delivered.has(item.name)) {
            issues.push(
                `${item.name} is required in production but is missing from the delivered environment.`
            );
        }
    }

    if (issues.length > 0) {
        console.error('Delivered Server environment does not match the schema:');
        for (const issue of issues) {
            console.error(`- ${issue}`);
        }
        process.exit(1);
    }

    console.log(
        `Delivered Server environment matches the schema (${delivered.size} names, none stale, every production-required secret present).`
    );
}

if (import.meta.main) {
    main();
}
