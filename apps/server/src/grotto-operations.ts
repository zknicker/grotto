import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const errorTailLength = 2048;

export function copyEnvironmentWithout(...names: string[]) {
    const environment = { ...process.env };
    for (const name of names) {
        delete environment[name];
    }
    return environment;
}

export function postgresEnvironment(databaseUrl: string) {
    const url = new URL(databaseUrl);
    return {
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGHOST: url.hostname,
        PGPASSWORD: decodeURIComponent(url.password),
        PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username),
    };
}

export async function runGrottoCommand(
    command: string,
    args: string[],
    options: {
        cwd?: string;
        env?: Record<string, string | undefined>;
        redact?: string[];
    } = {}
) {
    const child = Bun.spawn([command, ...args], {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stderr: 'pipe',
        stdout: 'ignore',
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0) {
        const detail = redact(stderr.slice(-errorTailLength), [
            ...(options.redact ?? []),
            ...sensitiveEnvironmentValues(options.env ?? process.env),
        ]);
        throw new Error(
            `${basename(command)} failed with exit code ${exitCode}${detail ? `: ${detail}` : '.'}`
        );
    }
}

export async function sha256(path: string) {
    return createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
}

function sensitiveEnvironmentValues(environment: Record<string, string | undefined>) {
    return Object.entries(environment)
        .filter(([name, value]) => {
            return (
                Boolean(value) &&
                /(ACCESS_KEY|CREDENTIAL|DATABASE_URL|PASSWORD|PING_URL|REPOSITORY|SECRET|TOKEN)/u.test(
                    name
                )
            );
        })
        .map(([, value]) => value ?? '');
}

function redact(value: string, secrets: string[]) {
    let result = value.trim();
    for (const secret of secrets.filter(Boolean)) {
        result = result.replaceAll(secret, '[redacted]');
    }
    return result;
}
