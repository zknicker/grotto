import path from 'node:path';

import { detectChromeApplications } from './chrome-detection.ts';
import { BrowserCommandQueue } from './command-queue.ts';
import type { BrowserLaunchContract } from './launch-contract.ts';
import { ChromeLifecycle } from './lifecycle.ts';
import { ProfileLock } from './profile-lock.ts';
import { BrowserSupervisor } from './supervisor.ts';
import type { ChromeApplication } from './types.ts';

export interface BrowserService {
    application: ChromeApplication;
    commandQueue: BrowserCommandQueue;
    contract: BrowserLaunchContract;
    lifecycle: ChromeLifecycle;
    lock: ProfileLock;
    profileName: string;
    root: string;
    supervisor: BrowserSupervisor;
}

let activeService: BrowserService | null = null;
let statusListener: (() => void) | null = null;

// Wired at Computer boot to refresh Browser capability health when
// the supervisor's state changes.
export function setBrowserStatusListener(listener: () => void): void {
    statusListener = listener;
}

export function browserProfilesRoot(root: string): string {
    return path.join(root, 'profiles');
}

// Profile directories are durable machine state: nothing in Computer deletes
// them — not upgrades, plugin disablement, or profile switching.
export function browserUserDataDir(root: string, profileName: string): string {
    return path.join(browserProfilesRoot(root), profileName);
}

export function getBrowserService(): BrowserService | null {
    return activeService;
}

export interface StartBrowserServiceOptions {
    launchBrowser?: boolean;
    profileName: string;
    root: string;
}

// Starts in-process browser supervision. Detection or launch failures leave
// the service stopped and surface through capability health; they never throw
// into Computer startup.
export async function startBrowserService(
    options: StartBrowserServiceOptions
): Promise<BrowserService | null> {
    if (activeService?.profileName === options.profileName && activeService.root === options.root) {
        return activeService;
    }
    stopBrowserService();

    const [application] = await detectChromeApplications();
    if (!application) {
        console.warn('browser: no supported Chrome installation detected');
        return null;
    }

    const userDataDir = browserUserDataDir(options.root, options.profileName);
    const contract: BrowserLaunchContract = {
        executablePath: application.executablePath,
        userDataDir,
    };
    const lock = new ProfileLock(`${userDataDir}.lock`);
    const commandQueue = new BrowserCommandQueue();
    const lifecycle = new ChromeLifecycle({ contract, lock });
    const supervisor = new BrowserSupervisor({
        browserVersion: application.version,
        commandQueue,
        lifecycle,
        onStatusChanged: () => statusListener?.(),
    });

    activeService = {
        application,
        commandQueue,
        contract,
        lifecycle,
        lock,
        profileName: options.profileName,
        root: options.root,
        supervisor,
    };

    if (options.launchBrowser !== false) {
        await supervisor.start();
    }
    return activeService;
}

// Stops supervision only. Chrome was launched detached and stays running so
// Computer restarts and upgrades do not interrupt browser sessions; the next
// boot re-adopts the managed process.
export function stopBrowserService(): void {
    const service = activeService;
    if (!service) {
        return;
    }
    activeService = null;
    service.supervisor.stop();
    service.lock.release();
}
