#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const releaseBaseUrl = trimTrailingSlash(requireEnv('GROTTO_RELEASE_BASE_URL'));

requireSigningEnvironment();
requireNotarizationEnvironment();

process.env.GROTTO_RELEASE_BASE_URL = releaseBaseUrl;
// electron-builder reads the signing identity under its own literal name.
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

// The Developer ID certificate and its private key stay in the operator's
// login Keychain; only the identity's name travels, and it is public.
function requireSigningEnvironment() {
    if (process.env.CSC_NAME?.trim() || process.env.APPLE_SIGNING_IDENTITY?.trim()) {
        return;
    }

    console.error('release error: missing APPLE_SIGNING_IDENTITY (or CSC_NAME)');
    process.exit(1);
}

// One notarization path: the Apple ID and app-specific password resolve from
// 1Password through the release switch in .env.schema.
function requireNotarizationEnvironment() {
    if (
        process.env.APPLE_ID?.trim() &&
        process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim() &&
        process.env.APPLE_TEAM_ID?.trim()
    ) {
        return;
    }

    console.error(
        'release error: missing Apple notarization credentials. Run the release under `varlock run` with GROTTO_RESOLVE_RELEASE_TOKENS=true so APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID resolve.'
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
