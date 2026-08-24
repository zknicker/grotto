import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
    console.error('Grotto desktop release install is only supported on macOS.');
    process.exit(1);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const sourceAppPath = join(
    repositoryRoot,
    'apps',
    'website',
    'electron-dist',
    'mac-arm64',
    'Grotto.app'
);
const destinationAppPath = '/Applications/Grotto.app';

if (!existsSync(sourceAppPath)) {
    console.error(`Built app not found at ${sourceAppPath}.`);
    process.exit(1);
}

rmSync(destinationAppPath, { force: true, recursive: true });
execFileSync('/usr/bin/ditto', ['--rsrc', '--extattr', sourceAppPath, destinationAppPath]);

console.log(`Installed Grotto.app to ${destinationAppPath}`);
