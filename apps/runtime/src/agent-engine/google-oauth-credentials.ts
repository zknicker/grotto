import fs from 'node:fs';
import path from 'node:path';
import { readConfigValue, resolveConfiguredPath } from '../config.ts';

export const googleOAuthClientIdEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_ID';
export const googleOAuthClientSecretEnv = 'TAVERN_GOOGLE_OAUTH_CLIENT_SECRET';

export interface GoogleOAuthCredentials {
    clientId: string;
    clientSecret: string;
}

interface GoogleOAuthCredentialCandidate {
    clientId?: unknown;
    clientSecret?: unknown;
}

const googleOAuthAssetPath = path.join('google', 'oauth-client.json');

export function getRequiredGoogleOAuthCredentials(): GoogleOAuthCredentials {
    const envCredentials = normalizeCredentialCandidate({
        clientId: readConfigValue(googleOAuthClientIdEnv),
        clientSecret: readConfigValue(googleOAuthClientSecretEnv),
    });
    if (envCredentials) {
        return envCredentials;
    }

    const assetCredentials = readPackagedGoogleOAuthCredentials();
    if (assetCredentials) {
        return assetCredentials;
    }

    throw new Error(
        `${googleOAuthClientIdEnv} and ${googleOAuthClientSecretEnv} are required for Google OAuth.`
    );
}

function readPackagedGoogleOAuthCredentials(): GoogleOAuthCredentials | null {
    const errors: unknown[] = [];
    for (const filePath of googleOAuthAssetPaths()) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const credentials = normalizeCredentialCandidate(
                parsed && typeof parsed === 'object'
                    ? {
                          clientId: (parsed as Record<string, unknown>).clientId,
                          clientSecret: (parsed as Record<string, unknown>).clientSecret,
                      }
                    : {}
            );
            if (credentials) {
                return credentials;
            }
        } catch (error) {
            errors.push(error);
        }
    }

    if (errors.some((error) => error instanceof SyntaxError)) {
        throw new Error('Packaged Google OAuth client asset is not valid JSON.', {
            cause: errors.find((error) => error instanceof SyntaxError),
        });
    }

    return null;
}

function googleOAuthAssetPaths() {
    return uniquePaths(
        [configuredRuntimeAssetPath(), homebrewRuntimeAssetPath()].filter(
            (candidate): candidate is string => Boolean(candidate)
        )
    );
}

function configuredRuntimeAssetPath() {
    const assetsDir = readConfigValue('TAVERN_RUNTIME_ASSETS_DIR');
    return assetsDir ? path.join(resolveConfiguredPath(assetsDir), googleOAuthAssetPath) : null;
}

function homebrewRuntimeAssetPath() {
    return path.join(
        path.dirname(process.execPath),
        '..',
        'share',
        'grotto',
        'runtime-assets',
        googleOAuthAssetPath
    );
}

function normalizeCredentialCandidate(
    candidate: GoogleOAuthCredentialCandidate
): GoogleOAuthCredentials | null {
    const clientId = typeof candidate.clientId === 'string' ? candidate.clientId.trim() : '';
    const clientSecret =
        typeof candidate.clientSecret === 'string' ? candidate.clientSecret.trim() : '';

    if (!(clientId || clientSecret)) {
        return null;
    }

    if (!(clientId && clientSecret)) {
        throw new Error(
            `${googleOAuthClientIdEnv} and ${googleOAuthClientSecretEnv} must both be set for Google OAuth.`
        );
    }

    return { clientId, clientSecret };
}

function uniquePaths(paths: readonly string[]) {
    return [...new Set(paths.map((candidate) => path.resolve(candidate)))];
}
