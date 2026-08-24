#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './release-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

loadEnvFile();

const releaseBaseUrl = trimTrailingSlash(requireEnv('GROTTO_RELEASE_BASE_URL'));

requireSigningEnvironment();
requireNotarizationEnvironment();

process.env.GROTTO_RELEASE_BASE_URL = releaseBaseUrl;
process.env.APPLE_APP_SPECIFIC_PASSWORD ??= process.env.APPLE_PASSWORD;
process.env.CSC_NAME ??= normalizeSigningIdentity(process.env.APPLE_SIGNING_IDENTITY);

runElectronBuilder(['--config', 'electron-builder.config.cjs', '--mac', '--publish', 'never']);

function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        console.error(`release error: missing ${name}`);
        process.exit(1);
    }

    return value;
}

function requireSigningEnvironment() {
    if (process.env.CSC_NAME?.trim() || process.env.APPLE_SIGNING_IDENTITY?.trim()) {
        return;
    }

    if (
        (process.env.CSC_LINK?.trim() || process.env.APPLE_CERTIFICATE?.trim()) &&
        (process.env.CSC_KEY_PASSWORD?.trim() || process.env.APPLE_CERTIFICATE_PASSWORD?.trim())
    ) {
        return;
    }

    console.error('release error: missing CSC_NAME or CSC_LINK + CSC_KEY_PASSWORD');
    process.exit(1);
}

function requireNotarizationEnvironment() {
    const hasAppleIdCredentials =
        process.env.APPLE_ID?.trim() &&
        (process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() || process.env.APPLE_PASSWORD?.trim()) &&
        process.env.APPLE_TEAM_ID?.trim();
    const hasApiCredentials =
        process.env.APPLE_API_KEY?.trim() &&
        process.env.APPLE_API_KEY_ID?.trim() &&
        process.env.APPLE_API_ISSUER?.trim() &&
        process.env.APPLE_API_KEY_PATH?.trim();

    if (hasAppleIdCredentials || hasApiCredentials) {
        return;
    }

    console.error(
        'release error: missing Apple notarization credentials. Set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID or APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER + APPLE_API_KEY_PATH'
    );
    process.exit(1);
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}

function normalizeSigningIdentity(identity) {
    return identity?.replace(/^Developer ID Application:\s*/u, '').trim();
}

function runElectronBuilder(args) {
    const child = spawn('bun', ['x', 'electron-builder', ...args], {
        cwd: path.join(repoRoot, 'apps', 'website'),
        env: process.env,
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
