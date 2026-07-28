import {
    computerProtocolVersion,
    validateSignedComputerRelease,
} from './computer-release-contract.mjs';

export async function checkComputerReleasePrerequisite(
    manifestUrl = process.env.GROTTO_COMPUTER_RELEASE_MANIFEST_URL ??
        'https://releases.grotto.sh/computer/latest.json'
) {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`production Computer descriptor returned ${response.status}`);
    }
    const descriptor = await response.json();
    validateSignedComputerRelease(descriptor);
    if (descriptor.release.protocolVersion < computerProtocolVersion) {
        throw new Error(
            `production Computer protocol ${descriptor.release.protocolVersion} is below required protocol ${computerProtocolVersion}`
        );
    }
    return descriptor.release;
}
