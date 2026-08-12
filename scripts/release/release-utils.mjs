import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '..', '..');

export const readJson = async (relativePath) => {
    const raw = await readText(relativePath);
    return JSON.parse(raw);
};

export const updateJson = async (relativePath, updater) => {
    const absolutePath = path.join(repoRoot, relativePath);
    const raw = await readFile(absolutePath, 'utf8');
    const next = updater(JSON.parse(raw));
    const trailingNewline = raw.endsWith('\n') ? '\n' : '';
    const serialized = `${JSON.stringify(next, null, detectIndent(raw))}${trailingNewline}`;

    if (serialized !== raw) {
        await writeFile(absolutePath, serialized, 'utf8');
    }
};

export const readText = async (relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath);
    return readFile(absolutePath, 'utf8');
};

export const writeText = async (relativePath, content) => {
    const absolutePath = path.join(repoRoot, relativePath);
    await writeFile(absolutePath, content, 'utf8');
};

export const readFlagValue = (args, flag) => {
    const index = args.indexOf(flag);
    if (index === -1) {
        return null;
    }

    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
        fail(`missing value for ${flag}`);
    }

    return value;
};

export const isSemver = (value) => /^\d+\.\d+\.\d+$/.test(value);

export const parseVersion = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) {
        return null;
    }

    return {
        major: Number.parseInt(match[1], 10),
        minor: Number.parseInt(match[2], 10),
        patch: Number.parseInt(match[3], 10),
    };
};

export const compareVersions = (left, right) => {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);

    if (!(leftParts && rightParts)) {
        fail('version comparison failed due to invalid semver input', { left, right });
    }

    if (leftParts.major !== rightParts.major) {
        return leftParts.major > rightParts.major ? 1 : -1;
    }

    if (leftParts.minor !== rightParts.minor) {
        return leftParts.minor > rightParts.minor ? 1 : -1;
    }

    if (leftParts.patch !== rightParts.patch) {
        return leftParts.patch > rightParts.patch ? 1 : -1;
    }

    return 0;
};

export const todayDateString = () => new Date().toISOString().slice(0, 10);

export const runGit = async (args) => {
    return execFileAsync('git', args, {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024 * 8,
    });
};

export const findSingleGitLine = async (args) => {
    try {
        const { stdout } = await runGit(args);
        return (
            stdout
                .split('\n')
                .map((value) => value.trim())
                .find(Boolean) ?? null
        );
    } catch {
        return null;
    }
};

export const loadEnvFile = (relativePath = '.env') => {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
        return;
    }

    for (const line of readFileSync(absolutePath, 'utf8').split(/\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        const key = trimmed.slice(0, separatorIndex);
        const value = unquoteEnvValue(trimmed.slice(separatorIndex + 1));

        process.env[key] ??= value;
    }
};

export const fail = (message, details) => {
    console.error(`release error: ${message}`);
    if (details) {
        console.error(JSON.stringify(details, null, 4));
    }

    process.exit(1);
};

const detectIndent = (raw) => {
    const match = raw.match(/\n( +)"[^"\n]+":/);
    return match ? match[1].length : 2;
};

const unquoteEnvValue = (value) => {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    return value;
};
