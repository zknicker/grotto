import path from 'node:path';

import { asError, type EffectRuntime, settle } from '@grotto/effect';
import { Effect } from 'effect';
import { detectChromeApplications } from './chrome-detection.ts';
import { BrowserCommandQueue } from './command-queue.ts';
import type { BrowserLaunchContract } from './launch-contract.ts';
import { ChromeLifecycle } from './lifecycle.ts';
import { ProfileLock } from './profile-lock.ts';
import { BrowserSupervisor, type BrowserSupervisorStopMode } from './supervisor.ts';
import { browserFailureLogAnnotations } from './supervisor-operations.ts';
import type { ChromeApplication } from './types.ts';

export interface BrowserService {
    application: ChromeApplication;
    commandQueue: BrowserCommandQueue;
    contract: BrowserLaunchContract;
    lock: Pick<ProfileLock, 'release'>;
    profileName: string;
    root: string;
    supervisor: BrowserSupervisor;
}

let statusListener: (() => void) | null = null;

export function setBrowserStatusListener(listener: () => void): void {
    statusListener = listener;
}

export function browserProfilesRoot(root: string): string {
    return path.join(root, 'profiles');
}

export function browserUserDataDir(root: string, profileName: string): string {
    return path.join(browserProfilesRoot(root), profileName);
}

export function getBrowserService(): BrowserService | null {
    return browserServices?.get() ?? null;
}

export interface StartBrowserServiceOptions {
    launchBrowser?: boolean;
    profileName: string;
    root: string;
}

export interface BrowserServiceDesiredState {
    enabled: boolean;
    profileName: string;
}

interface BrowserServiceCoordinatorOptions {
    create(
        runtime: EffectRuntime<never>,
        application: ChromeApplication,
        options: StartBrowserServiceOptions
    ): BrowserService;
    detect(): Promise<ChromeApplication[]>;
}

export class BrowserServiceCoordinator {
    private active: BrowserService | null = null;
    private readonly transitions: Effect.Semaphore;

    constructor(
        private readonly runtime: EffectRuntime<never>,
        private readonly options: BrowserServiceCoordinatorOptions
    ) {
        this.transitions = runtime.runSync(Effect.makeSemaphore(1));
    }

    ownsRuntime(runtime: EffectRuntime<never>): boolean {
        return this.runtime === runtime;
    }

    get(): BrowserService | null {
        return this.active;
    }

    start(options: StartBrowserServiceOptions): Promise<BrowserService | null> {
        return this.transition(this.startUnlocked(options));
    }

    stop(mode: BrowserSupervisorStopMode = 'preserve-browser', root?: string): Promise<void> {
        return this.transition(this.stopUnlocked(mode, root));
    }

    reconcile(
        root: string,
        desired: () => Promise<BrowserServiceDesiredState>
    ): Promise<BrowserService | null> {
        return this.transition(
            Effect.gen(this, function* () {
                const state = yield* Effect.tryPromise({ catch: asError, try: desired });
                if (state.enabled) {
                    return yield* this.startUnlocked({ profileName: state.profileName, root });
                }
                yield* this.stopUnlocked('stop-browser', root);
                return null;
            })
        );
    }

    private startUnlocked(
        options: StartBrowserServiceOptions
    ): Effect.Effect<BrowserService | null, Error> {
        return Effect.gen(this, function* () {
            if (
                this.active?.profileName === options.profileName &&
                this.active.root === options.root
            ) {
                return this.active;
            }
            const stopMode =
                this.active?.root === options.root ? 'stop-browser' : 'preserve-browser';
            yield* this.stopUnlocked(stopMode);

            const [application] = yield* Effect.tryPromise({
                catch: asError,
                try: () => this.options.detect(),
            });
            if (!application) {
                yield* Effect.logWarning(
                    'Browser supervision is unavailable because Chrome was not detected.'
                ).pipe(
                    Effect.annotateLogs(
                        browserFailureLogAnnotations('browser.detect', 'unavailable')
                    )
                );
                return null;
            }

            const service = yield* Effect.try({
                catch: asError,
                try: () => this.options.create(this.runtime, application, options),
            });
            this.active = service;
            if (options.launchBrowser !== false) {
                yield* Effect.tryPromise({
                    catch: asError,
                    try: () => service.supervisor.start(),
                });
            }
            return service;
        });
    }

    private stopUnlocked(
        mode: BrowserSupervisorStopMode,
        root?: string
    ): Effect.Effect<void, Error> {
        return Effect.gen(this, function* () {
            const service = this.active;
            if (!service || (root !== undefined && service.root !== root)) {
                return;
            }
            this.active = null;
            yield* Effect.tryPromise({
                catch: asError,
                try: () => teardownBrowserService(service, mode),
            });
        });
    }

    private transition<A>(operation: Effect.Effect<A, Error>): Promise<A> {
        return settle(this.runtime, this.transitions.withPermits(1)(operation));
    }
}

const browserServiceOptions: BrowserServiceCoordinatorOptions = {
    create: createBrowserService,
    detect: detectChromeApplications,
};
let browserServices: BrowserServiceCoordinator | null = null;

export async function startBrowserService(
    options: StartBrowserServiceOptions,
    runtime: EffectRuntime<never>
): Promise<BrowserService | null> {
    return await browserCoordinator(runtime).start(options);
}

export async function reconcileBrowserService(
    root: string,
    desired: () => Promise<BrowserServiceDesiredState>,
    runtime: EffectRuntime<never>
): Promise<BrowserService | null> {
    return await browserCoordinator(runtime).reconcile(root, desired);
}

function createBrowserService(
    runtime: EffectRuntime<never>,
    application: ChromeApplication,
    options: StartBrowserServiceOptions
): BrowserService {
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
        runtime,
    });

    return {
        application,
        commandQueue,
        contract,
        lock,
        profileName: options.profileName,
        root: options.root,
        supervisor,
    };
}

// Ordinary shutdown preserves detached Chrome. Settings teardown requests the
// stop-browser mode so Chrome exits before the profile lock is released.
export async function stopBrowserService(
    mode: BrowserSupervisorStopMode = 'preserve-browser',
    root?: string
): Promise<void> {
    const coordinator = browserServices;
    if (!coordinator) {
        return;
    }
    await coordinator.stop(mode, root);
    if (coordinator.get() === null) {
        browserServices = null;
    }
}

export async function teardownBrowserService(
    service: {
        lock: Pick<ProfileLock, 'release'>;
        supervisor: Pick<BrowserSupervisor, 'stop'>;
    },
    mode: BrowserSupervisorStopMode
): Promise<void> {
    try {
        await service.supervisor.stop(mode);
    } finally {
        service.lock.release();
    }
}

function browserCoordinator(runtime: EffectRuntime<never>): BrowserServiceCoordinator {
    if (browserServices?.ownsRuntime(runtime)) {
        return browserServices;
    }
    if (browserServices?.get()) {
        throw new Error('Browser supervision belongs to another Computer daemon runtime.');
    }
    browserServices = new BrowserServiceCoordinator(runtime, browserServiceOptions);
    return browserServices;
}
