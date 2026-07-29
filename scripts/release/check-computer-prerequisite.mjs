import {
    computerProtocolVersion,
    verifySignedComputerRelease,
} from './computer-release-contract.mjs';
import { readComputerReleasePublicKey } from './computer-release-keys.mjs';

export async function checkComputerReleasePrerequisite(
    manifestUrl = process.env.GROTTO_COMPUTER_RELEASE_MANIFEST_URL ??
        'https://releases.grotto.sh/computer/latest.json',
    publicKey = requiredReleasePublicKey()
) {
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`production Computer descriptor returned ${response.status}`);
    }
    const descriptor = await response.json();
    verifySignedComputerRelease(descriptor, publicKey);
    if (descriptor.release.protocolVersion < computerProtocolVersion) {
        throw new Error(
            `production Computer protocol ${descriptor.release.protocolVersion} is below required protocol ${computerProtocolVersion}`
        );
    }
    return descriptor.release;
}

function requiredReleasePublicKey() {
    const value = readComputerReleasePublicKey();
    if (!value) {
        throw new Error(
            'GROTTO_COMPUTER_RELEASE_PUBLIC_KEY or its macOS Keychain item is required'
        );
    }
    return value;
}
