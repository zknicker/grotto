import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Runs a throwaway PostgreSQL cluster so hosted Server tests exercise real
 * PostgreSQL instead of a mock. Each cluster owns its own data directory and
 * port, so parallel test files never share rows.
 *
 * `postgres` runs as a direct child rather than through `pg_ctl start`, which
 * daemonises it: a daemonised cluster outlives a killed test runner or
 * Playwright web server and leaks for the life of the machine.
 */
export interface PostgresCluster {
    databaseUrl: string;
    stop(): void;
}

const clusterUser = 'grotto';
const clusterDatabase = 'grotto_test';
const readyTimeoutMs = 20_000;
const readyPollMs = 50;

export async function startPostgresCluster(): Promise<PostgresCluster> {
    const binaries = resolvePostgresBinaries();
    const root = mkdtempSync(join(tmpdir(), 'grotto-postgres-'));
    const dataDirectory = join(root, 'data');
    const port = reserveLoopbackPort();

    run(binaries.initdb, [
        '--auth=trust',
        '--encoding=UTF8',
        '--no-sync',
        '--username',
        clusterUser,
        '--pgdata',
        dataDirectory,
    ]);

    const server = spawn(
        binaries.postgres,
        [
            '-D',
            dataDirectory,
            '-p',
            String(port),
            '-h',
            '127.0.0.1',
            '-k',
            root,
            '-c',
            'fsync=off',
            '-c',
            'full_page_writes=off',
        ],
        { stdio: 'ignore' }
    );

    // SIGINT is PostgreSQL's fast shutdown: it releases the cluster's System V
    // shared-memory segment, which SIGKILL leaks — and macOS allows only 32
    // before no cluster can start at all. The directory is swept again once
    // the child is actually reaped, since shutdown outlives the first sweep.
    server.once('exit', () => rmSync(root, { force: true, recursive: true }));

    let stopped = false;
    const stop = () => {
        if (stopped) {
            return;
        }

        stopped = true;
        process.off('exit', stop);
        server.kill('SIGINT');
        rmSync(root, { force: true, recursive: true });
    };

    // A test that throws before its teardown would otherwise leave the data
    // directory behind even though the child dies with this process.
    process.once('exit', stop);

    try {
        await waitForReadyCluster(binaries, port, server);
        run(binaries.createdb, [
            '--host',
            '127.0.0.1',
            '--port',
            String(port),
            '--username',
            clusterUser,
            clusterDatabase,
        ]);
    } catch (error) {
        stop();
        throw error;
    }

    return {
        databaseUrl: `postgres://${clusterUser}@127.0.0.1:${port}/${clusterDatabase}`,
        stop,
    };
}

interface PostgresBinaries {
    createdb: string;
    initdb: string;
    pgIsReady: string;
    postgres: string;
}

async function waitForReadyCluster(binaries: PostgresBinaries, port: number, server: ChildProcess) {
    const deadline = Date.now() + readyTimeoutMs;

    while (Date.now() < deadline) {
        if (server.exitCode !== null) {
            throw new Error(
                `The PostgreSQL test cluster exited with code ${server.exitCode} before accepting connections.`
            );
        }

        const ready = spawnSync(
            binaries.pgIsReady,
            ['--host', '127.0.0.1', '--port', String(port)],
            { stdio: 'ignore' }
        );

        if (ready.status === 0) {
            return;
        }

        await Bun.sleep(readyPollMs);
    }

    throw new Error('The PostgreSQL test cluster did not accept connections in time.');
}

function resolvePostgresBinaries(): PostgresBinaries {
    const explicitRoot = process.env.GROTTO_POSTGRES_BIN;
    const searchRoots = explicitRoot
        ? [explicitRoot]
        : ['/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', ''];

    for (const searchRoot of searchRoots) {
        const candidate = {
            createdb: join(searchRoot, 'createdb'),
            initdb: join(searchRoot, 'initdb'),
            pgIsReady: join(searchRoot, 'pg_isready'),
            postgres: join(searchRoot, 'postgres'),
        };

        if (spawnSync(candidate.initdb, ['--version'], { stdio: 'ignore' }).status === 0) {
            return candidate;
        }
    }

    throw new Error(
        'PostgreSQL is required for hosted Server tests but its binaries were not found. Install PostgreSQL 16 (`brew install postgresql@16`) or point GROTTO_POSTGRES_BIN at its bin directory.'
    );
}

function run(command: string, args: string[]) {
    const result = spawnSync(command, args, { encoding: 'utf8' });

    if (result.status !== 0) {
        throw new Error(
            `Failed to provision the PostgreSQL test cluster: ${command} exited ${result.status}.\n${result.stderr ?? ''}`
        );
    }
}

function reserveLoopbackPort(): number {
    const socket = Bun.listen({
        hostname: '127.0.0.1',
        port: 0,
        socket: { data: () => undefined },
    });
    const { port } = socket;

    socket.stop(true);
    return port;
}
