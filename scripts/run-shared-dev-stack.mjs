import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultSharedStackId = 'tavern-shared';

function main() {
    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
    const runnerPath = path.join(scriptDirectory, 'run-dev-stack.mjs');
    const args = process.argv.slice(2);
    const runnerArgs = args.length > 0 ? args : ['desktop'];
    const result = spawnSync(process.execPath, [runnerPath, ...runnerArgs], {
        cwd: path.resolve(scriptDirectory, '..'),
        env: {
            ...process.env,
            GROTTO_DEV_STACK_ID: process.env.GROTTO_DEV_STACK_ID ?? defaultSharedStackId,
        },
        stdio: 'inherit',
    });

    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }

    process.exit(result.status ?? 1);
}

main();
