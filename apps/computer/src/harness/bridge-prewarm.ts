// Boot-time bridge pre-warm: populate the shared pnpm store once per server
// tree, so an Agent's first bootstrap hard-links the runtime's platform binary
// locally instead of fetching it — first turns stop paying install time, and
// concurrent fresh Agents stop racing the network.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bridgeStoreDirForAgentsRoot, readBridgePrewarmPlans } from './bridge-bootstrap.ts';

type RunCommand = (command: string, cwd: string) => Promise<number>;

/**
 * Warms every bridge's install into the shared store. Never throws and never
 * blocks attach readiness: a failed warm only means the first Agent bootstrap
 * fetches from the network, exactly as before pre-warming existed. Harnesses
 * warm serially on purpose — the point is to avoid contending downloads.
 */
export async function prewarmBridgeStores({
    agentsRoot,
    log = (line: string) => console.error(line),
    run = runShellCommand,
}: {
    agentsRoot: string;
    log?: (line: string) => void;
    run?: RunCommand;
}): Promise<void> {
    const storeDir = bridgeStoreDirForAgentsRoot(agentsRoot);
    for (const plan of await readBridgePrewarmPlans()) {
        const directory = join(agentsRoot, '.harness-bridge-prewarm', plan.harnessId);
        try {
            await mkdir(directory, { mode: 0o700, recursive: true });
            for (const file of plan.files) {
                await writeFile(join(directory, file.name), file.content);
            }
            const startedAt = Date.now();
            const exitCode = await run(plan.command(storeDir), directory);
            const seconds = Math.round((Date.now() - startedAt) / 1000);
            log(
                exitCode === 0
                    ? `[bridge-prewarm] ${plan.harnessId} store warm (${seconds}s)`
                    : `[bridge-prewarm] ${plan.harnessId} warm failed (exit ${exitCode}); first Agent bootstrap will fetch instead`
            );
        } catch (error) {
            log(`[bridge-prewarm] ${plan.harnessId} warm skipped: ${String(error).slice(0, 200)}`);
        }
    }
}

async function runShellCommand(command: string, cwd: string): Promise<number> {
    const child = Bun.spawn(['sh', '-c', command], {
        cwd,
        env: { ...process.env, CI: 'true' },
        stderr: 'ignore',
        stdin: 'ignore',
        stdout: 'ignore',
    });
    return await child.exited;
}
