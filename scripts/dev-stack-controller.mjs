import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import readline from 'node:readline';
import {
    hasGrottoSchema,
    prepareDevPostgres,
    reserveDevPostgresPort,
    stopStaleDevPostgres,
    waitForDevPostgres,
} from './dev-postgres.mjs';
import {
    assertDevStackPortsAvailable,
    cleanupStaleProcesses,
    createDevStackConfig,
    createDevStackEnvironment,
    isDesktopMode,
    isSuppressedStartupLine,
    startupEventPrefix,
    stripAnsi,
    waitForPort,
} from './dev-stack-shared.mjs';

const shutdownProcessOrder = ['desktop', 'website', 'computer', 'grotto', 'server', 'postgres'];
const shutdownTimeoutMs = Number.parseInt(
    process.env.TAVERN_DEV_SHUTDOWN_TIMEOUT_MS ?? '30000',
    10
);
const processGroupShutdownPollMs = 50;
const serverDependencyPrebuildCommand = 'bun run --filter @tavern/sdk build';

export class DevStackController extends EventEmitter {
    constructor({
        mode,
        ports,
        repositoryRoot,
        clerkEnvironmentOverrides = {},
        spawnImpl = spawn,
    }) {
        super();
        this.mode = mode;
        this.ports = ports;
        this.repositoryRoot = repositoryRoot;
        this.clerkEnvironmentOverrides = clerkEnvironmentOverrides;
        this.spawnImpl = spawnImpl;
        this.processes = new Map();
        this.backgroundProcesses = new Set();
        this.expectedProcessStops = new Set();
        this.isStopping = false;
        this.isSteadyState = false;
        this.stopPromise = null;
        this.snapshot = this.createInitialSnapshot();
    }

    createInitialSnapshot() {
        const isDesktop = isDesktopMode(this.mode);

        return {
            config: createDevStackConfig({
                mode: this.mode,
                ports: this.ports,
                repositoryRoot: this.repositoryRoot,
            }),
            phase: 'starting',
            jobs: {
                items: [],
                state: 'idle',
            },
            logs: [],
            processes: {
                computer: { status: 'waiting' },
                desktop: { status: isDesktop ? 'waiting' : 'disabled' },
                grotto: { status: 'waiting' },
                postgres: { status: 'waiting' },
                server: { status: 'waiting' },
                website: { status: 'waiting' },
            },
            staleCleanupCount: 0,
        };
    }

    getSnapshot() {
        return this.snapshot;
    }

    update(mutator) {
        mutator(this.snapshot);
        this.emit('update', this.snapshot);
        this.maybeEnterSteadyState();
    }

    addLog(source, line) {
        if (!line || isSuppressedStartupLine(source, line)) {
            return;
        }

        const entry = { line, source };
        this.update((snapshot) => {
            snapshot.logs = [...snapshot.logs, entry].slice(-40);
        });
        this.emit('log', entry);
    }

    applyStartupEvent(event) {
        this.update((snapshot) => {
            if (event.source === 'server' && event.type === 'jobs.loading') {
                snapshot.jobs.state = 'loading';
                return;
            }

            if (event.source === 'server' && event.type === 'jobs.ready') {
                snapshot.jobs.state = 'ready';
                return;
            }

            if (event.source === 'server' && event.type === 'jobs.item') {
                const existingIndex = snapshot.jobs.items.findIndex(
                    (item) => item.key === event.payload.key
                );
                const nextItem = {
                    cadence: event.payload.cadence,
                    immediate: event.payload.immediate,
                    key: event.payload.key,
                    label: event.payload.label,
                    state: event.payload.state,
                };

                if (existingIndex === -1) {
                    snapshot.jobs.items = [...snapshot.jobs.items, nextItem].sort((left, right) =>
                        left.label.localeCompare(right.label)
                    );
                } else {
                    snapshot.jobs.items = snapshot.jobs.items.map((item, index) =>
                        index === existingIndex ? nextItem : item
                    );
                }
                return;
            }
        });
    }

    parseOutputLine(source, line) {
        const normalizedLine = stripAnsi(line);

        if (source === 'desktop' && /Running `.*tavern-desktop`/u.test(normalizedLine)) {
            this.addLog(source, normalizedLine);
            this.update((snapshot) => {
                snapshot.processes.desktop.status = 'running';
            });
            return;
        }

        if (normalizedLine.startsWith(startupEventPrefix)) {
            try {
                const event = JSON.parse(normalizedLine.slice(startupEventPrefix.length));
                this.applyStartupEvent(event);
            } catch {
                this.addLog(source, normalizedLine);
            }
            return;
        }

        this.addLog(source, normalizedLine);
    }

    attachProcessOutput(source, child) {
        const attach = (stream) => {
            if (!stream) {
                return;
            }

            const reader = readline.createInterface({ input: stream });
            reader.on('line', (line) => {
                this.parseOutputLine(source, line);
            });
        };

        attach(child.stdout);
        attach(child.stderr);
    }

    spawnProcess(source, executable, args = [], options = {}) {
        this.update((snapshot) => {
            snapshot.processes[source].status = 'starting';
        });

        const child = this.spawnImpl(executable, args, {
            cwd: options.cwd ?? this.repositoryRoot,
            detached: true,
            env: options.env ?? process.env,
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.processes.set(source, child);
        this.attachProcessOutput(source, child);

        child.on('exit', (code, signal) => {
            if (this.expectedProcessStops.delete(source)) {
                return;
            }
            if (!this.isStopping) {
                this.update((snapshot) => {
                    snapshot.processes[source].status = code === 0 ? 'stopped' : 'error';
                });
                this.addLog(source, `process exited (${signal ?? code ?? 'unknown'})`);
                void this.stop(code ?? 1);
            }
        });

        child.on('error', (error) => {
            this.update((snapshot) => {
                snapshot.processes[source].status = 'error';
            });
            this.addLog(source, error.message);
            void this.stop(1);
        });

        return child;
    }

    spawnBackgroundProcess(source, command, env = process.env) {
        const child = this.spawnImpl(command, {
            cwd: this.repositoryRoot,
            detached: true,
            env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.attachProcessOutput(source, child);
        this.backgroundProcesses.add(child);

        return new Promise((resolve) => {
            child.on('exit', (code, signal) => {
                this.backgroundProcesses.delete(child);
                if (code !== 0 && !this.isStopping) {
                    this.addLog(source, `prebuild exited (${signal ?? code ?? 'unknown'})`);
                }
                resolve(code === 0);
            });

            child.on('error', (error) => {
                this.backgroundProcesses.delete(child);
                if (!this.isStopping) {
                    this.addLog(source, error.message);
                }
                resolve(false);
            });
        });
    }

    cleanupStaleProcesses() {
        const devStackEnvironment = createDevStackEnvironment({
            ports: this.ports,
            repositoryRoot: this.repositoryRoot,
        });
        this.update((snapshot) => {
            snapshot.staleCleanupCount =
                cleanupStaleProcesses({
                    mode: this.mode,
                    ports: this.ports,
                    repositoryRoot: this.repositoryRoot,
                }) + stopStaleDevPostgres(devStackEnvironment);
        });
    }

    async start() {
        this.cleanupStaleProcesses();
        assertDevStackPortsAvailable({
            mode: this.mode,
            ports: this.ports,
            repositoryRoot: this.repositoryRoot,
        });

        const devStackEnvironment = createDevStackEnvironment({
            ports: this.ports,
            repositoryRoot: this.repositoryRoot,
        });
        const computerDirectory = path.join(this.repositoryRoot, 'apps', 'computer');
        const serverDirectory = path.join(this.repositoryRoot, 'apps', 'server');
        const websiteDirectory = path.join(this.repositoryRoot, 'apps', 'website');
        const startupUiEnv = {
            ...devStackEnvironment,
            TAVERN_STARTUP_UI: '1',
        };
        const hostedServerUrl = `http://localhost:${this.ports.grottoPort}`;
        const websiteEnv = {
            ...startupUiEnv,
            VITE_GROTTO_APP_ORIGIN: startupUiEnv.APP_ORIGIN,
            VITE_GROTTO_SERVER_ORIGIN: hostedServerUrl,
            VITE_SERVER_ORIGIN: `http://localhost:${this.ports.serverPort}`,
        };

        const serverEnv = {
            ...startupUiEnv,
            TAVERN_EXIT_ON_ORPHAN: '1',
        };
        let websiteReadyPromise = null;
        let desktopPrebuildPromise = null;
        let serverDependencyPrebuildPromise = null;

        const startServerDependencyPrebuild = () => {
            if (!serverDependencyPrebuildPromise) {
                serverDependencyPrebuildPromise = this.spawnBackgroundProcess(
                    'server',
                    serverDependencyPrebuildCommand,
                    startupUiEnv
                );
            }

            return serverDependencyPrebuildPromise;
        };

        const startWebsite = () => {
            if (!websiteReadyPromise) {
                this.spawnProcess(
                    'website',
                    'bun',
                    ['x', 'vite', '--host', '127.0.0.1', '--port', String(this.ports.websitePort)],
                    {
                        cwd: websiteDirectory,
                        env: websiteEnv,
                    }
                );
                websiteReadyPromise = waitForPort(Number(this.ports.websitePort)).then(() => {
                    this.update((snapshot) => {
                        snapshot.processes.website.status = 'running';
                    });
                });
            }
        };

        const getDesktopEnv = () =>
            createDesktopDevEnvironment({
                clerkEnvironmentOverrides: this.clerkEnvironmentOverrides,
                devStackEnvironment,
                ports: this.ports,
            });

        const startDesktopPrebuild = () => {
            if (!(isDesktopMode(this.mode) && !desktopPrebuildPromise)) {
                return;
            }

            const desktopEnv = getDesktopEnv();
            const prebuildCommand = [
                'node scripts/build-macos-app-icon.mjs',
                'node scripts/build-electron-sidecar.mjs',
            ].join(' && ');
            desktopPrebuildPromise = this.spawnBackgroundProcess(
                'desktop',
                prebuildCommand,
                desktopEnv
            );
        };

        startDesktopPrebuild();
        if (!(await startServerDependencyPrebuild())) {
            throw new Error('Failed to build server workspace dependencies.');
        }

        const postgres = prepareDevPostgres(devStackEnvironment, await reserveDevPostgresPort());
        const postgresChild = this.spawnProcess('postgres', postgres.executable, postgres.args, {
            env: startupUiEnv,
        });
        await waitForDevPostgres(postgres, postgresChild);
        this.update((snapshot) => {
            snapshot.processes.postgres.status = 'running';
        });

        const hostedServerEnv = {
            ...startupUiEnv,
            ...this.clerkEnvironmentOverrides,
            APP_ORIGIN: startupUiEnv.APP_ORIGIN ?? `http://localhost:${this.ports.websitePort}`,
            GROTTO_DATABASE_URL: postgres.databaseUrl,
            GROTTO_SERVER_PORT: String(this.ports.grottoPort),
        };
        if (hasGrottoSchema(postgres)) {
            const migrated = await this.spawnBackgroundProcess(
                'grotto',
                'bun apps/server/src/grotto-server-migrate.ts',
                {
                    ...hostedServerEnv,
                    GROTTO_DATABASE_MIGRATION_URL: postgres.databaseUrl,
                    GROTTO_DATABASE_BACKUP_ROLE: 'grotto',
                    GROTTO_DATABASE_RUNTIME_ROLE: 'grotto',
                }
            );
            if (!migrated) {
                const dataRoot = devStackEnvironment.GROTTO_POSTGRES_DATA_ROOT;
                throw new Error(
                    'Failed to migrate the hosted development Server database. ' +
                        `If this dev database predates checked-in migrations, move ${dataRoot} aside and rerun.`
                );
            }
        } else {
            const bootstrapped = await this.spawnBackgroundProcess(
                'grotto',
                'bun apps/server/src/grotto-server-bootstrap.ts',
                {
                    ...hostedServerEnv,
                    GROTTO_DATABASE_BOOTSTRAP_URL: postgres.databaseUrl,
                    GROTTO_DATABASE_BACKUP_ROLE: 'grotto',
                    GROTTO_DATABASE_RUNTIME_ROLE: 'grotto',
                }
            );
            if (!bootstrapped) {
                throw new Error('Failed to bootstrap the hosted development Server.');
            }
        }

        this.spawnProcess('server', 'bun', ['--watch', 'src/index.ts'], {
            cwd: serverDirectory,
            env: serverEnv,
        });
        await waitForPort(Number(this.ports.serverPort));
        this.update((snapshot) => {
            snapshot.processes.server.status = 'running';
        });

        this.spawnProcess('grotto', 'bun', ['--watch', 'src/grotto-server.ts'], {
            cwd: serverDirectory,
            env: hostedServerEnv,
        });
        await waitForPort(Number(this.ports.grottoPort));
        this.update((snapshot) => {
            snapshot.processes.grotto.status = 'running';
        });

        this.spawnProcess('computer', 'bun', ['--watch', 'src/index.ts', 'start'], {
            cwd: computerDirectory,
            env: {
                ...startupUiEnv,
                GROTTO_COMPUTER_RESIDENT: '1',
                GROTTO_COMPUTER_WATCH_ATTACHMENT_DAEMON: '1',
                GROTTO_SERVER_ORIGIN: hostedServerUrl,
            },
        });
        this.update((snapshot) => {
            snapshot.processes.computer.status = 'running';
        });

        startWebsite();
        await websiteReadyPromise;

        if (isDesktopMode(this.mode)) {
            if (desktopPrebuildPromise) {
                await desktopPrebuildPromise;
            }
            this.spawnProcess(
                'desktop',
                'node',
                ['scripts/run-desktop-dev.mjs', '--skip-server-cleanup'],
                { env: getDesktopEnv() }
            );
            this.update((snapshot) => {
                snapshot.processes.desktop.status = 'running';
            });
        }

        this.maybeEnterSteadyState();
    }

    async stop(exitCode = 0, options = {}) {
        if (this.stopPromise) {
            if (options.force) {
                this.signalManagedProcesses('SIGTERM');
            }
            return this.stopPromise;
        }
        this.isStopping = true;

        this.stopPromise = (async () => {
            const shutdownSignal = options.signal ?? 'SIGTERM';
            this.addLog(
                'tavern',
                options.signal ? `shutdown requested (${options.signal})` : 'shutdown requested'
            );
            this.update((snapshot) => {
                snapshot.phase = 'stopping';
            });

            this.signalManagedProcesses(shutdownSignal);

            for (const source of shutdownProcessOrder) {
                await this.stopProcess(source, { signaled: true });
            }

            this.emit('exit', exitCode);
        })();

        return this.stopPromise;
    }

    signalManagedProcesses(signal) {
        for (const [source, child] of this.processes) {
            signalChildProcessGroup(child, source === 'postgres' ? 'SIGINT' : signal);
        }
        this.signalBackgroundProcesses(signal);
    }

    signalBackgroundProcesses(signal) {
        for (const child of this.backgroundProcesses) {
            signalChildProcessGroup(child, signal);
        }
    }

    async stopProcess(source, options = {}) {
        const child = this.processes.get(source);

        if (!child) {
            return;
        }

        this.update((snapshot) => {
            snapshot.processes[source].status = 'stopping';
        });
        this.addLog(source, 'stopping');

        if (options.expected) {
            this.expectedProcessStops.add(source);
        }

        const stopped = await waitForChildShutdown(
            child,
            options.signaled
                ? undefined
                : () => {
                      signalChildProcessGroup(child, 'SIGTERM');
                  }
        );
        this.expectedProcessStops.delete(source);

        if (!stopped) {
            this.addLog(
                source,
                `shutdown timed out after ${Math.round(shutdownTimeoutMs / 1000)}s; killing`
            );
            signalChildProcessGroup(child, 'SIGKILL');
            await waitForChildShutdown(child);
        }

        this.processes.delete(source);
        this.update((snapshot) => {
            snapshot.processes[source].status = 'stopped';
        });
    }

    maybeEnterSteadyState() {
        if (this.isSteadyState || !isStartupComplete(this.snapshot)) {
            return;
        }

        this.isSteadyState = true;
        this.update((snapshot) => {
            snapshot.phase = 'running';
        });
        this.emit('steady');
    }
}

export function createDesktopDevEnvironment({
    clerkEnvironmentOverrides,
    devStackEnvironment,
    ports,
}) {
    return {
        ...devStackEnvironment,
        ...clerkEnvironmentOverrides,
        TAVERN_SERVER_PORT: String(ports.serverPort),
        TAVERN_WEBSITE_PORT: String(ports.websitePort),
    };
}

export function signalChildProcessGroup(child, signal, killProcessGroup = process.kill) {
    if (!child.pid) {
        return false;
    }

    try {
        killProcessGroup(-child.pid, signal);
        return true;
    } catch {
        if (child.exitCode !== null || child.signalCode !== null) {
            return false;
        }

        return child.kill(signal);
    }
}

export function waitForChildShutdown(child, beforeWait, options = {}) {
    const isProcessGroupActive =
        options.isProcessGroupActive ??
        (() => {
            return isChildProcessGroupActive(child);
        });
    const pollMs = options.pollMs ?? processGroupShutdownPollMs;
    const timeoutMs = options.timeoutMs ?? shutdownTimeoutMs;
    let childExited = child.exitCode !== null || child.signalCode !== null;

    if (!child.pid) {
        return Promise.resolve(childExited);
    }

    return new Promise((resolve) => {
        let interval = null;
        const timeout = setTimeout(() => {
            child.off('exit', onExit);
            if (interval) {
                clearInterval(interval);
            }
            resolve(false);
        }, timeoutMs);

        const finish = () => {
            clearTimeout(timeout);
            if (interval) {
                clearInterval(interval);
            }
            child.off('exit', onExit);
            resolve(true);
        };

        const checkShutdown = () => {
            if (childExited && !isProcessGroupActive()) {
                finish();
            }
        };

        const onExit = () => {
            childExited = true;
            checkShutdown();
        };

        if (!childExited) {
            child.once('exit', onExit);
        }

        interval = setInterval(checkShutdown, pollMs);
        beforeWait?.();
        checkShutdown();
    });
}

function isChildProcessGroupActive(child) {
    if (!child.pid) {
        return false;
    }

    try {
        process.kill(-child.pid, 0);
        return true;
    } catch {
        return false;
    }
}

function isStartupComplete(snapshot) {
    const desktopReady =
        snapshot.processes.desktop.status === 'disabled' ||
        snapshot.processes.desktop.status === 'running';
    const grottoReady = snapshot.processes.grotto.status === 'running';
    const computerReady = snapshot.processes.computer.status === 'running';
    const postgresReady = snapshot.processes.postgres.status === 'running';

    return (
        snapshot.processes.server.status === 'running' &&
        computerReady &&
        grottoReady &&
        postgresReady &&
        snapshot.processes.website.status === 'running' &&
        desktopReady &&
        snapshot.jobs.state === 'ready'
    );
}
