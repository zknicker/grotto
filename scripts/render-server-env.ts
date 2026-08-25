#!/usr/bin/env bun
/**
 * Renders the hosted Grotto Server's delivered runtime environment.
 *
 * The launchd job runs `operations/run-server`, which shell-sources
 * `config/server.env`. That file is the analogue of Compose baking environment
 * into a container spec: the platform's delivered copy, never the authority.
 * The authority is the committed `.env.schema`, and this program is the only
 * thing that writes the copy — under `varlock run` with VARLOCK_ENV=production,
 * so every value arrives already resolved from 1Password.
 *
 * It writes exactly the names the Server's typed env module validates, and
 * nothing else. It never prints a value.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliverableNames, readSchemaItems } from './lib/env-schema.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const defaultTarget = '/Users/zknicker/srv/grotto/config/server.env';
const serviceUser = '_grotto_server';

function serverEnvironmentNames(): string[] {
    const module = readFileSync(join(repositoryRoot, 'apps/server/src/config/env.ts'), 'utf8');
    const body = module.slice(module.indexOf('const envSchema'));
    return [...body.matchAll(/^ {8}([A-Z][A-Z0-9_]*):/gmu)].map((match) => match[1]);
}

function shellQuote(value: string) {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}

function main() {
    if (process.env.VARLOCK_ENV && process.env.VARLOCK_ENV !== 'production') {
        throw new Error('render-server-env must run under VARLOCK_ENV=production.');
    }

    const target = process.argv[2] ?? defaultTarget;
    const deliverable = deliverableNames(readSchemaItems(join(repositoryRoot, '.env.schema')));
    const names = serverEnvironmentNames();

    if (names.length === 0) {
        throw new Error(
            'No names were extracted from the Server typed env module; refusing to render an empty environment.'
        );
    }

    const unknown = names.filter((name) => !deliverable.has(name));
    if (unknown.length > 0) {
        throw new Error(
            `The Server validates ${unknown.join(', ')}, which .env.schema does not deliver.`
        );
    }

    const lines = [
        '# Delivered runtime copy of the Grotto Server environment.',
        '# Rendered from the repository .env.schema by scripts/render-server-env.ts',
        '# during a deploy. Do not edit: the next deploy overwrites it, and the',
        '# schema is the only owner of every value below.',
    ];
    const rendered: string[] = [];
    for (const name of names.sort()) {
        const value = process.env[name];
        // Absent is absent: writing NAME='' would make the Server's zod schema
        // treat the value as present and reject it instead of applying its
        // default.
        if (value === undefined || value === '') {
            continue;
        }
        lines.push(`${name}=${shellQuote(value)}`);
        rendered.push(name);
    }

    const staging = `${target}.staging`;
    writeFileSync(staging, `${lines.join('\n')}\n`, { mode: 0o600 });
    chmodSync(staging, 0o600);
    // The runner writes as `zknicker`; the launchd job reads as _grotto_server.
    // An explicit ACL grants exactly that one read, without widening the file's
    // POSIX mode and without any privileged helper.
    execFileSync('/bin/chmod', ['+a', `${serviceUser} allow read`, staging]);
    renameSync(staging, target);

    console.log(`Rendered ${rendered.length} Server environment names to ${target}:`);
    for (const name of rendered) {
        console.log(`  ${name}`);
    }
}

if (import.meta.main) {
    main();
}

export { serverEnvironmentNames, shellQuote };
