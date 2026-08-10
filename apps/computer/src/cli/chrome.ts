import { computerSourceRevision, computerVersion } from '../build-identity.ts';
import { readProductionRelease } from '../update.ts';
import { type ComputerHelpRequest, renderComputerHelpPage } from './help.ts';
import { stdoutRenderer } from './render.ts';
import { readComputerUpdateStatus } from './update-check.ts';

/**
 * Shared page chrome for grotto-computer commands: the one-line header on
 * working commands, the arch banner on the global help page, and the
 * freshness status line. Headers and the status line only print on a TTY so
 * pipes, scripts, and the launchd log stay plain; help pages always carry
 * their own identity because the page is the product.
 */

const identity = { version: computerVersion };

export async function printComputerHeader(options: {
    dataRoot: string;
    updateStatus?: boolean;
}): Promise<boolean> {
    if (process.stdout.isTTY !== true) {
        return false;
    }
    console.log(stdoutRenderer.header(identity));
    if (options.updateStatus) {
        console.log(stdoutRenderer.updateStatusLine(await computeUpdateStatus(options.dataRoot)));
    }
    console.log('');
    return true;
}

export async function printComputerHelpPage(
    request: ComputerHelpRequest,
    options: { dataRoot: string; omitHeader?: boolean }
): Promise<void> {
    if (!options.omitHeader) {
        if (request.kind === 'global') {
            console.log(stdoutRenderer.banner(identity));
            if (process.stdout.isTTY === true) {
                console.log(
                    stdoutRenderer.updateStatusLine(await computeUpdateStatus(options.dataRoot))
                );
            }
        } else {
            console.log(stdoutRenderer.header(identity));
        }
        console.log('');
    }
    console.log(renderComputerHelpPage(request, stdoutRenderer));
    if (request.error) {
        process.exitCode = 1;
    }
}

async function computeUpdateStatus(dataRoot: string) {
    return await readComputerUpdateStatus({
        currentVersion: computerVersion,
        dataRoot,
        fetchLatestVersion: async (signal) =>
            (await readProductionRelease(undefined, { signal })).release.version,
        sourceRevision: computerSourceRevision,
    });
}
