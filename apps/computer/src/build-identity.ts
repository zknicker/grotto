import computerPackage from '../package.json' with { type: 'json' };

export const computerVersion = process.env.GROTTO_COMPUTER_BUILD_VERSION ?? computerPackage.version;
export const computerSourceRevision =
    process.env.GROTTO_COMPUTER_BUILD_SOURCE_REVISION ?? 'development';
export const computerReleasePublicKey = process.env.GROTTO_COMPUTER_BUILD_RELEASE_PUBLIC_KEY ?? '';
export const computerAppleTeamId = process.env.GROTTO_COMPUTER_BUILD_APPLE_TEAM_ID ?? '';
export const computerAppleSigningIdentity =
    process.env.GROTTO_COMPUTER_BUILD_APPLE_SIGNING_IDENTITY ?? '';
export const computerStandalone = process.env.GROTTO_COMPUTER_BUILD_STANDALONE === '1';

export function computerEntrypoint(): { args: string[]; executable: string } {
    if (computerStandalone) {
        return { args: [], executable: process.execPath };
    }
    return {
        args: [new URL('index.ts', import.meta.url).pathname],
        executable: process.execPath,
    };
}

export function computerRunnerEntrypoint(
    serverId: string,
    options: { watch: boolean }
): { args: string[]; executable: string } {
    const entrypoint = computerEntrypoint();
    return {
        args: [
            ...(options.watch && !computerStandalone ? ['--watch'] : []),
            ...entrypoint.args,
            'run',
            serverId,
        ],
        executable: entrypoint.executable,
    };
}
