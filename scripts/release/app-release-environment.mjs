import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';

const publishableKeyEnvironmentName = 'VITE_CLERK_PUBLISHABLE_KEY';
const publishableKeyService = 'grotto-release-clerk-publishable-key';

export function loadAppReleaseEnvironment(options = {}) {
    const environment = options.environment ?? process.env;
    const configured = environment[publishableKeyEnvironmentName]?.trim();
    if (configured) {
        return configured;
    }

    const readKeychainPassword = options.readKeychainPassword ?? defaultKeychainPassword;
    const stored = readKeychainPassword(publishableKeyService)?.trim();
    if (!stored) {
        throw new Error(
            `${publishableKeyEnvironmentName} is required. Set it in the environment or store it in the login Keychain service ${publishableKeyService}.`
        );
    }

    environment[publishableKeyEnvironmentName] = stored;
    return stored;
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
