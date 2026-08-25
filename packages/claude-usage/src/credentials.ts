import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { ClaudeUsageParseError } from './errors.ts';
import type {
    ClaudeCredentials,
    ClaudeCredentialsLoadOptions,
    ClaudeLoadedCredentials,
} from './types.ts';

const execFileAsync = promisify(execFile);
const DEFAULT_KEYCHAIN_SERVICE = 'Claude Code-credentials';

const claudeOauthSchema = z
    .object({
        accessToken: z.string().trim().min(1),
        expiresAt: z.number().finite().optional(),
        refreshToken: z.string().trim().min(1).optional(),
        subscriptionType: z.string().trim().min(1).optional(),
    })
    .passthrough();

const claudeCredentialsDocumentSchema = z
    .object({
        claudeAiOauth: claudeOauthSchema,
    })
    .passthrough();

export function resolveClaudeCredentialsPath(options: ClaudeCredentialsLoadOptions = {}): string {
    return (
        options.credentialsPath ??
        path.join(options.homeDir ?? os.homedir(), '.claude', '.credentials.json')
    );
}

export function parseClaudeCredentialsDocument(input: unknown): {
    credentials: ClaudeCredentials;
    document: Record<string, unknown>;
} {
    const document = claudeCredentialsDocumentSchema.parse(input);

    return {
        credentials: {
            accessToken: document.claudeAiOauth.accessToken,
            expiresAt: document.claudeAiOauth.expiresAt ?? null,
            refreshToken: document.claudeAiOauth.refreshToken ?? null,
            subscriptionType: document.claudeAiOauth.subscriptionType ?? null,
        },
        document,
    };
}

export async function loadClaudeCredentials(
    options: ClaudeCredentialsLoadOptions = {}
): Promise<ClaudeLoadedCredentials | null> {
    const credentialsPath = resolveClaudeCredentialsPath(options);
    const keychainFirst = (options.platform ?? process.platform) === 'darwin';

    if (keychainFirst) {
        const keychain = await loadKeychainCredentials(options);
        if (keychain && !credentialsExpired(keychain.credentials, options.now)) {
            return keychain;
        }
    }

    try {
        const raw = await readFile(credentialsPath, 'utf8');
        const parsed = parseClaudeCredentialsDocument(JSON.parse(raw));

        const loaded: ClaudeLoadedCredentials = {
            credentials: parsed.credentials,
            document: parsed.document,
            path: credentialsPath,
            source: 'file',
        };
        if (!credentialsExpired(loaded.credentials, options.now)) {
            return loaded;
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            if (error instanceof SyntaxError || error instanceof z.ZodError) {
                throw new ClaudeUsageParseError(`Invalid Claude credentials at ${credentialsPath}`);
            }

            throw error;
        }
    }

    if (!keychainFirst) {
        const keychain = await loadKeychainCredentials(options);
        if (keychain && !credentialsExpired(keychain.credentials, options.now)) {
            return keychain;
        }
    }

    const token = options.environment?.CLAUDE_CODE_OAUTH_TOKEN?.trim();
    if (!token) {
        return null;
    }

    return {
        credentials: {
            accessToken: token,
            expiresAt: null,
            refreshToken: null,
            subscriptionType: null,
        },
        document: null,
        path: null,
        source: 'environment',
    };
}

async function loadKeychainCredentials(
    options: ClaudeCredentialsLoadOptions
): Promise<ClaudeLoadedCredentials | null> {
    if (options.useKeychain === false) {
        return null;
    }
    const keychainJson = await (options.readKeychain ?? readClaudeKeychain)(
        options.keychainService ?? DEFAULT_KEYCHAIN_SERVICE
    );
    if (!keychainJson) {
        return null;
    }
    try {
        const parsed = parseClaudeCredentialsDocument(JSON.parse(keychainJson));
        return {
            credentials: parsed.credentials,
            document: parsed.document,
            path: null,
            source: 'keychain',
        };
    } catch (error) {
        if (error instanceof SyntaxError || error instanceof z.ZodError) {
            throw new ClaudeUsageParseError('Invalid Claude credentials in Keychain');
        }
        throw error;
    }
}

function credentialsExpired(credentials: ClaudeCredentials, now = new Date()): boolean {
    return credentials.expiresAt !== null && credentials.expiresAt <= now.getTime();
}

async function readClaudeKeychain(service: string): Promise<string | null> {
    // The Keychain is a macOS store. Everywhere else the honest answer is "no
    // credential here" — spawning /usr/bin/security would just fail with
    // ENOENT and take the file-credential fallback down with it.
    if (process.platform !== 'darwin') {
        return null;
    }

    try {
        const { stdout } = await execFileAsync('/usr/bin/security', [
            'find-generic-password',
            '-s',
            service,
            '-w',
        ]);

        const value = stdout.trim();
        return value.length > 0 ? value : null;
    } catch (error) {
        const exitCode = (error as { code?: number | string }).code;
        // 44 is "item not found"; ENOENT is a machine without the binary.
        if (exitCode === 44 || exitCode === '44' || exitCode === 'ENOENT') {
            return null;
        }

        throw error;
    }
}
