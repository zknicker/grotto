import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

function isTestEnvironment() {
    return process.env.NODE_ENV === 'test';
}

function getDefaultTestDatabasePath() {
    return join(os.tmpdir(), 'tavern-tests', `tavern-${process.pid}.sqlite`);
}

export function getDefaultDatabasePath() {
    if (isTestEnvironment()) {
        return getDefaultTestDatabasePath();
    }

    return join(os.homedir(), '.grotto', 'grotto.sqlite');
}

export function getDefaultGrottoServerPort() {
    const port = process.env.GROTTO_SERVER_PORT;

    return port && isValidPort(port) ? Number(port) : 8090;
}

export function getDefaultDatabaseUrl() {
    return `postgres://127.0.0.1:5432/grotto${isTestEnvironment() ? '_test' : ''}`;
}

export function getDefaultClerkIssuerUrl() {
    return 'https://clerk.grotto.sh';
}

function resolveHomePath(value: string) {
    if (value === '~') {
        return os.homedir();
    }

    if (value.startsWith('~/')) {
        return join(os.homedir(), value.slice(2));
    }

    return value;
}

export function getDefaultAppOrigin() {
    const websitePort = process.env.TAVERN_WEBSITE_PORT;

    return `http://localhost:${isValidPort(websitePort) ? websitePort : '3100'}`;
}

export function getDefaultServerPort() {
    const serverPort = process.env.TAVERN_SERVER_PORT;

    return serverPort && isValidPort(serverPort) ? Number(serverPort) : 8080;
}

function findUpwards(filename: string, startDirectory: string) {
    let directory = startDirectory;

    while (true) {
        const candidate = resolve(directory, filename);

        if (existsSync(candidate)) {
            return candidate;
        }

        const parentDirectory = resolve(directory, '..');

        if (parentDirectory === directory) {
            return null;
        }

        directory = parentDirectory;
    }
}

const envPath = findUpwards('.env', process.cwd());

function stripMatchingQuotes(value: string) {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
}

function loadEnvFile(path: string) {
    const fileContents = readFileSync(path, 'utf8');

    for (const line of fileContents.split(/\r?\n/u)) {
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');

        if (separatorIndex < 1) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = stripMatchingQuotes(trimmed.slice(separatorIndex + 1).trim());

        if (isTestEnvironment() && key === 'DATABASE_PATH') {
            continue;
        }

        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

if (envPath) {
    loadEnvFile(envPath);
}

applyCliOverrides(process.argv.slice(2));

const envSchema = z.object({
    APP_ORIGIN: z.string().url().default(getDefaultAppOrigin()),
    CLERK_ISSUER_URL: z.string().url().default(getDefaultClerkIssuerUrl()),
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    DATABASE_PATH: z.string().min(1).default(getDefaultDatabasePath()).transform(resolveHomePath),
    GROTTO_DATABASE_URL: z.string().min(1).default(getDefaultDatabaseUrl()),
    GROTTO_SERVER_PORT: z.coerce.number().int().positive().default(getDefaultGrottoServerPort()),
    GROTTO_STATIC_APP_ROOT: z.string().min(1).transform(resolveHomePath).optional(),
    DEV_CLERK_SIGN_IN_USER_ID: z.string().min(1).optional(),
    TAVERN_RUNTIME_URL: z.string().url().optional(),
    SERVER_PORT: z.coerce.number().int().positive().default(getDefaultServerPort()),
});

export const env = envSchema.parse(process.env);

function applyCliOverrides(args: string[]) {
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        const nextValue = args[index + 1];

        if (!nextValue || nextValue.startsWith('--')) {
            continue;
        }

        switch (argument) {
            case '--app-origin':
                process.env.APP_ORIGIN = nextValue;
                index += 1;
                break;
            case '--tavern-runtime-url':
                process.env.TAVERN_RUNTIME_URL = nextValue;
                index += 1;
                break;
            case '--database-path':
                process.env.DATABASE_PATH = nextValue;
                index += 1;
                break;
            case '--server-port':
                process.env.SERVER_PORT = nextValue;
                index += 1;
                break;
            default:
                break;
        }
    }
}

function isValidPort(value: string | undefined) {
    if (!(value && /^\d+$/u.test(value))) {
        return false;
    }

    const numericValue = Number(value);

    return Number.isInteger(numericValue) && numericValue > 0 && numericValue <= 65_535;
}
