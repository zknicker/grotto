import fs from 'node:fs';
import path from 'node:path';

// Identity-affecting Chrome flags are pinned. Changing password-store or
// keychain mode invalidates the profile's cookie encryption, so the contract
// is recorded beside the profile and an incompatible launch is refused.
export const browserPasswordStore = 'basic';
export const browserUseMockKeychain = true;
export const browserDisableSkiaGraphite = true;

export const browserPinnedArguments = [
    '--disable-background-networking',
    '--disable-backgrounding-occluded-windows',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-hang-monitor',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-sync',
    '--disable-features=Translate',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--metrics-recording-only',
    '--disable-blink-features=AutomationControlled',
] as const;

export interface BrowserLaunchContract {
    executablePath: string;
    userDataDir: string;
}

export function buildLaunchArguments(contract: BrowserLaunchContract): string[] {
    return [
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        `--password-store=${browserPasswordStore}`,
        '--use-mock-keychain',
        `--user-data-dir=${contract.userDataDir}`,
        '--disable-skia-graphite',
        ...browserPinnedArguments,
    ];
}

// The profile-compatibility fingerprint: any process writing this user-data
// directory must carry these flags or cookies and login state are at risk.
export function isProfileCompatible(command: string, contract: BrowserLaunchContract): boolean {
    const required = [
        `--user-data-dir=${contract.userDataDir}`,
        `--password-store=${browserPasswordStore}`,
        '--remote-debugging-port=0',
        '--use-mock-keychain',
    ];
    return required.every((flag) => command.includes(flag));
}

// Full managed launch contract: only a process matching every pinned flag is
// re-adopted as Tavern's managed Chrome.
export function hasManagedLaunchContract(
    command: string,
    contract: BrowserLaunchContract
): boolean {
    if (!isProfileCompatible(command, contract)) {
        return false;
    }
    if (!command.includes('--disable-skia-graphite')) {
        return false;
    }
    return browserPinnedArguments.every((flag) => command.includes(flag));
}

interface CookieModeMarker {
    passwordStore: string;
    schemaVersion: number;
    useMockKeychain: boolean;
}

export function cookieModeMarkerPath(userDataDir: string): string {
    const profilesRoot = path.dirname(userDataDir);
    return path.join(profilesRoot, `${path.basename(userDataDir)}.mode.json`);
}

export function verifyCookieModeMarker(userDataDir: string): { reason: string | null } {
    const markerPath = cookieModeMarkerPath(userDataDir);
    let content: string;
    try {
        content = fs.readFileSync(markerPath, 'utf8');
    } catch {
        writeCookieModeMarker(userDataDir);
        return { reason: null };
    }

    let marker: Partial<CookieModeMarker>;
    try {
        marker = JSON.parse(content) as Partial<CookieModeMarker>;
    } catch {
        return {
            reason: `Browser profile mode marker at ${markerPath} is unreadable. Refusing to launch with unknown cookie encryption.`,
        };
    }
    if (
        marker.passwordStore !== browserPasswordStore ||
        marker.useMockKeychain !== browserUseMockKeychain
    ) {
        return {
            reason: 'Browser profile was created with a different cookie-encryption mode. Launching would invalidate its cookies.',
        };
    }
    return { reason: null };
}

function writeCookieModeMarker(userDataDir: string): void {
    const marker: CookieModeMarker = {
        passwordStore: browserPasswordStore,
        schemaVersion: 1,
        useMockKeychain: browserUseMockKeychain,
    };
    const markerPath = cookieModeMarkerPath(userDataDir);
    fs.mkdirSync(path.dirname(markerPath), { mode: 0o700, recursive: true });
    fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { mode: 0o600 });
}
