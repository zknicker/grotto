import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDevEnvironment } from './dev-ports.mjs';

const desktopDevPidEnvironmentVariable = 'TAVERN_DESKTOP_DEV_PID';
const staleServerShutdownTimeoutMs = 3000;
const staleServerShutdownPollMs = 50;

export function parseDesktopDevArguments(arguments_) {
    const electronArguments = [];
    let pid;
    let port;
    let skipServerCleanup = false;
    let websitePort;
    let serverPort;

    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index];

        if (argument === '--pid') {
            const nextValue = arguments_[index + 1];

            if (!nextValue) {
                throw new Error('Missing value for --pid.');
            }

            pid = parsePid(nextValue);
            index += 1;
            continue;
        }

        if (argument === '--port') {
            port = parsePortArgument(argument, arguments_[index + 1], 'port');
            index += 1;
            continue;
        }

        if (argument === '--vite-port') {
            websitePort = parsePortArgument(argument, arguments_[index + 1], 'vite port');
            index += 1;
            continue;
        }

        if (argument === '--backend-port') {
            serverPort = parsePortArgument(argument, arguments_[index + 1], 'backend port');
            index += 1;
            continue;
        }

        if (argument === '--skip-server-cleanup') {
            skipServerCleanup = true;
            continue;
        }

        if (!(port || websitePort || argument.startsWith('-'))) {
            port = parsePort(argument, 'port');
            continue;
        }

        electronArguments.push(argument);
    }

    return {
        pid,
        port,
        serverPort,
        skipServerCleanup,
        electronArguments,
        websitePort,
    };
}

export function getDesktopDevEnvironment({
    baseEnvironment = process.env,
    pid,
    port,
    serverPort,
    websitePort,
} = {}) {
    const environment = getDevEnvironment({
        baseEnvironment,
        port,
        serverPort,
        websitePort,
    });

    if (!pid) {
        return environment;
    }

    return {
        ...environment,
        [desktopDevPidEnvironmentVariable]: pid,
    };
}

export function cleanupStaleDesktopDevServer({
    killImpl = process.kill,
    repositoryRoot,
    serverPort,
    spawnSyncImpl = spawnSync,
}) {
    const killedProcessIds = listStaleDesktopDevServerProcessIds({
        repositoryRoot,
        serverPort,
        spawnSyncImpl,
    });

    for (const pid of killedProcessIds) {
        killImpl(pid, 'SIGTERM');
    }

    if (killedProcessIds.length === 0) {
        return [];
    }

    waitForStaleDesktopDevServerShutdown({
        killImpl,
        repositoryRoot,
        serverPort,
        spawnSyncImpl,
    });

    return killedProcessIds;
}

function parsePid(value) {
    if (!/^[1-9]\d*$/u.test(value)) {
        throw new Error(`Expected a positive integer PID, received "${value}".`);
    }

    return value;
}

function parsePortArgument(argument, value, label) {
    if (!value) {
        throw new Error(`Missing value for ${argument}.`);
    }

    return parsePort(value, label);
}

function parsePort(value, label) {
    if (!/^\d+$/u.test(value)) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65_535) {
        throw new Error(`Expected a valid ${label}, received "${value}".`);
    }

    return value;
}

function runNodeScript(scriptPath, args = [], options = {}) {
    return spawnSync('node', [scriptPath, ...args], {
        stdio: 'inherit',
        ...options,
    });
}

function listListeningProcessIds({ port, spawnSyncImpl }) {
    const result = spawnSyncImpl('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
        encoding: 'utf8',
    });

    if (typeof result.stdout !== 'string' || result.stdout.trim().length === 0) {
        return [];
    }

    return result.stdout
        .split(/\s+/u)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function listStaleDesktopDevServerProcessIds({ repositoryRoot, serverPort, spawnSyncImpl }) {
    const serverDirectory = path.join(repositoryRoot, 'apps', 'server');

    return listListeningProcessIds({
        port: serverPort,
        spawnSyncImpl,
    })
        .filter((pid) => {
            const cwd = readProcessWorkingDirectory(pid, spawnSyncImpl);
            const command = readProcessCommand(pid, spawnSyncImpl);

            return cwd === serverDirectory && command.includes('bun --watch src/index.ts');
        })
        .map((pid) => Number(pid));
}

function readProcessWorkingDirectory(pid, spawnSyncImpl) {
    const result = spawnSyncImpl('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
        encoding: 'utf8',
    });

    if (typeof result.stdout !== 'string') {
        return null;
    }

    return (
        result.stdout
            .split('\n')
            .find((line) => line.startsWith('n'))
            ?.slice(1) ?? null
    );
}

function readProcessCommand(pid, spawnSyncImpl) {
    const result = spawnSyncImpl('ps', ['-p', pid, '-o', 'command='], {
        encoding: 'utf8',
    });

    return typeof result.stdout === 'string' ? result.stdout.trim() : '';
}

function sleep(durationMs) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, durationMs);
}

function waitForStaleDesktopDevServerShutdown({
    killImpl,
    repositoryRoot,
    serverPort,
    spawnSyncImpl,
}) {
    const shutdownDeadline = Date.now() + staleServerShutdownTimeoutMs;
    let escalated = false;

    while (Date.now() < shutdownDeadline) {
        const remainingProcessIds = listStaleDesktopDevServerProcessIds({
            repositoryRoot,
            serverPort,
            spawnSyncImpl,
        });

        if (remainingProcessIds.length === 0) {
            return;
        }

        if (!escalated) {
            for (const pid of remainingProcessIds) {
                killImpl(pid, 'SIGKILL');
            }

            escalated = true;
        }

        sleep(staleServerShutdownPollMs);
    }
}

function main() {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const repositoryRoot = path.resolve(currentDirectory, '..');
    const websiteDirectory = path.join(repositoryRoot, 'apps', 'website');
    const buildIconScriptPath = path.join(currentDirectory, 'build-macos-app-icon.mjs');
    const buildScriptPath = path.join(currentDirectory, 'build-electron-sidecar.mjs');
    const { electronArguments, pid, port, serverPort, skipServerCleanup, websitePort } =
        parseDesktopDevArguments(process.argv.slice(2));
    const environment = getDesktopDevEnvironment({ pid, port, serverPort, websitePort });

    if (!skipServerCleanup) {
        cleanupStaleDesktopDevServer({
            repositoryRoot,
            serverPort: environment.TAVERN_SERVER_PORT,
        });
    }

    const iconBuildResult = runNodeScript(buildIconScriptPath, [], {
        cwd: repositoryRoot,
    });

    if (iconBuildResult.status !== 0) {
        process.exit(iconBuildResult.status ?? 1);
    }

    const buildResult = runNodeScript(buildScriptPath, [], {
        cwd: repositoryRoot,
    });

    if (buildResult.status !== 0) {
        process.exit(buildResult.status ?? 1);
    }

    const child = spawn('bun', ['x', 'electron', 'electron/main.cjs', ...electronArguments], {
        cwd: websiteDirectory,
        env: {
            ...environment,
            TAVERN_ELECTRON_DEV_URL: `http://localhost:${environment.TAVERN_WEBSITE_PORT}`,
        },
        stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }

        process.exit(code ?? 1);
    });

    child.on('error', (error) => {
        console.error(error);
        process.exit(1);
    });
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    main();
}
