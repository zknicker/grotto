import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';

const privateKeyEnvironmentName = 'GROTTO_COMPUTER_RELEASE_PRIVATE_KEY';
const publicKeyEnvironmentName = 'GROTTO_COMPUTER_RELEASE_PUBLIC_KEY';
const privateKeyService = 'grotto-computer-release-ed25519-private';
const publicKeyService = 'grotto-computer-release-ed25519-public';

export function readComputerReleasePrivateKey(options) {
    return readComputerReleaseKey(privateKeyEnvironmentName, privateKeyService, options);
}

export function readComputerReleasePublicKey(options) {
    return readComputerReleaseKey(publicKeyEnvironmentName, publicKeyService, options);
}

export function normalizeStoredComputerReleaseKey(value) {
    const stored = value?.trim();
    if (!stored) {
        return null;
    }
    const normalized = stored.replaceAll('\\n', '\n');
    if (normalized.startsWith('-----BEGIN ')) {
        return normalized;
    }
    if (/^(?:[0-9a-f]{2})+$/iu.test(stored)) {
        const decoded = Buffer.from(stored, 'hex').toString('utf8').trim().replaceAll('\\n', '\n');
        if (decoded.startsWith('-----BEGIN ')) {
            return decoded;
        }
    }
    return normalized;
}

function readComputerReleaseKey(environmentName, service, options = {}) {
    const environment = options.environment ?? process.env;
    const configured = normalizeStoredComputerReleaseKey(environment[environmentName]);
    if (configured) {
        return configured;
    }
    const readKeychainPassword = options.readKeychainPassword ?? defaultKeychainPassword;
    return normalizeStoredComputerReleaseKey(readKeychainPassword(service));
}

function defaultKeychainPassword(service) {
    if (process.platform !== 'darwin') {
        return null;
    }
    try {
        return execFileSync(
            'security',
            ['find-generic-password', '-a', userInfo().username, '-s', service, '-w'],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
    } catch {
        return null;
    }
}
