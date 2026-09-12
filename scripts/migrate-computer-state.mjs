import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

/** Run only after stopping the resident Computer and its Agent processes. */
export async function migrateComputerState(options) {
    const source = resolve(options.sourceRoot);
    const destination = resolve(options.destinationRoot);
    if (source === destination || destination.startsWith(`${source}/`)) {
        throw new Error('The destination must be outside the source Computer root.');
    }
    if (!/^[a-z]+$/u.test(options.sourcePrefix) || options.sourcePrefix === 'haus') {
        throw new Error('Provide the previous lowercase identity prefix.');
    }
    if (existsSync(destination)) {
        throw new Error('Destination already exists; refusing to merge Computer state.');
    }
    const files = await stateFiles(source);
    const changes = [];
    for (const file of files) {
        const path = join(source, file);
        const before = await readFile(path, 'utf8');
        const value = JSON.parse(before);
        const after = JSON.stringify(renameState(value, options, source, destination), null, 2);
        if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(JSON.parse(after))) {
            changes.push({ file, before, after: `${after}\n`, mode: (await stat(path)).mode });
        }
    }
    const preview = { source, destination, files: changes.map(({ file }) => file) };
    if (!options.apply) {
        return preview;
    }
    const backup = resolve(options.backupRoot);
    if (
        backup.startsWith(`${source}/`) ||
        backup.startsWith(`${destination}/`) ||
        existsSync(backup)
    ) {
        throw new Error('Use a new backup directory outside both state roots.');
    }
    await mkdir(backup, { recursive: true, mode: 0o700 });
    for (const change of changes) {
        const path = join(backup, change.file);
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        await writeFile(path, change.before, { flag: 'wx', mode: 0o600 });
    }
    await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
    await rename(source, destination);
    for (const change of changes) {
        const path = join(destination, change.file);
        const temporary = `${path}.identity-next`;
        await writeFile(temporary, change.after, { flag: 'wx', mode: change.mode & 0o777 });
        await rename(temporary, path);
    }
    return preview;
}

function renameState(value, options, source, destination) {
    if (Array.isArray(value)) {
        return value.map((entry) => renameState(entry, options, source, destination));
    }
    if (value && typeof value === 'object') {
        const result = {};
        for (const [key, child] of Object.entries(value)) {
            const canonical = key.startsWith(`${options.sourcePrefix}Agent`)
                ? `haus${key.slice(options.sourcePrefix.length)}`
                : key;
            if (Object.hasOwn(result, canonical)) {
                throw new Error('State contains conflicting identity fields.');
            }
            result[canonical] = renameState(child, options, source, destination);
        }
        return result;
    }
    if (typeof value === 'string') {
        if (value === options.sourceOrigin) {
            return 'https://haus.chat';
        }
        if (value === source || value.startsWith(`${source}/`)) {
            return `${destination}${value.slice(source.length)}`;
        }
    }
    return value;
}

async function stateFiles(root) {
    const result = existsSync(join(root, 'login.json')) ? ['login.json'] : [];
    for (const server of await directories(join(root, 'servers'))) {
        const attachment = join('servers', server, 'attachment.json');
        if (existsSync(join(root, attachment))) {
            result.push(attachment);
        }
        for (const agent of await directories(join(root, 'servers', server, 'agents'))) {
            const session = join('servers', server, 'agents', agent, 'session.json');
            if (existsSync(join(root, session))) {
                result.push(session);
            }
        }
    }
    return result;
}

async function directories(root) {
    if (!existsSync(root)) {
        return [];
    }
    return (await readdir(root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

if (import.meta.main) {
    const { values } = parseArgs({
        options: {
            'source-root': { type: 'string' },
            'destination-root': { type: 'string' },
            'source-prefix': { type: 'string' },
            'source-origin': { type: 'string' },
            'backup-root': { type: 'string' },
            apply: { type: 'boolean', default: false },
        },
    });
    for (const key of ['source-root', 'destination-root', 'source-prefix']) {
        if (!values[key]) {
            throw new Error(`Missing --${key}.`);
        }
    }
    if (values.apply && !values['backup-root']) {
        throw new Error('Applying requires --backup-root.');
    }
    console.log(
        JSON.stringify(
            await migrateComputerState({
                sourceRoot: values['source-root'],
                destinationRoot: values['destination-root'],
                sourcePrefix: values['source-prefix'],
                sourceOrigin: values['source-origin'],
                backupRoot: values['backup-root'],
                apply: values.apply,
            }),
            null,
            2
        )
    );
}
