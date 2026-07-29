#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { computerArtifactName, computerProtocolVersion } from './computer-release-contract.mjs';
import { fail, repoRoot } from './release-utils.mjs';

export const computerReleaseRoot = path.join(repoRoot, 'apps', 'computer', 'release');
const computerEntitlementsPath = path.join(
    repoRoot,
    'scripts',
    'release',
    'computer-entitlements.plist'
);

export async function buildComputerArtifact(input) {
    const artifactPath = path.join(computerReleaseRoot, computerArtifactName);
    const publicKey = input.publicKey;
    await rm(computerReleaseRoot, { force: true, recursive: true });
    await mkdir(computerReleaseRoot, { recursive: true });
    run(
        'bun',
        [
            'build',
            'apps/computer/src/index.ts',
            '--compile',
            '--target=bun-darwin-arm64',
            '--outfile',
            artifactPath,
            '--env=GROTTO_COMPUTER_BUILD_*',
            '--no-compile-autoload-dotenv',
        ],
        {
            ...process.env,
            GROTTO_COMPUTER_BUILD_APPLE_SIGNING_IDENTITY: input.appleSigningIdentity,
            GROTTO_COMPUTER_BUILD_APPLE_TEAM_ID: input.appleTeamId,
            GROTTO_COMPUTER_BUILD_RELEASE_PUBLIC_KEY: publicKey,
            GROTTO_COMPUTER_BUILD_SOURCE_REVISION: input.sourceRevision,
            GROTTO_COMPUTER_BUILD_STANDALONE: '1',
            GROTTO_COMPUTER_BUILD_VERSION: input.version,
        }
    );
    await verifyComputerIdentity(artifactPath, input);
    return { artifactPath, publicKey };
}

export async function verifyComputerIdentity(artifactPath, expected) {
    const identity = JSON.parse(
        execFileSync(artifactPath, ['version'], { encoding: 'utf8' }).trim()
    );
    if (
        identity.version !== expected.version ||
        identity.protocolVersion !== computerProtocolVersion ||
        identity.sourceRevision !== expected.sourceRevision
    ) {
        fail('compiled Computer identity does not match its release', { expected, identity });
    }
}

export function signAndNotarizeComputer(artifactPath, input) {
    run('/usr/bin/codesign', [
        '--force',
        '--options',
        'runtime',
        '--timestamp',
        '--entitlements',
        computerEntitlementsPath,
        '--sign',
        input.appleSigningIdentity,
        artifactPath,
    ]);
    verifyAppleSignature(artifactPath, input);
    const archivePath = `${artifactPath}.zip`;
    run('/usr/bin/ditto', ['-c', '-k', '--keepParent', artifactPath, archivePath]);
    const notaryArgs = ['notarytool', 'submit', archivePath, '--wait', '--output-format', 'json'];
    if (process.env.APPLE_API_KEY?.trim()) {
        notaryArgs.push(
            '--key',
            process.env.APPLE_API_KEY_PATH,
            '--key-id',
            process.env.APPLE_API_KEY_ID,
            '--issuer',
            process.env.APPLE_API_ISSUER
        );
    } else {
        notaryArgs.push(
            '--apple-id',
            process.env.APPLE_ID,
            '--password',
            process.env.APPLE_APP_SPECIFIC_PASSWORD ?? process.env.APPLE_PASSWORD,
            '--team-id',
            input.appleTeamId
        );
    }
    const notarization = runJson('/usr/bin/xcrun', notaryArgs);
    if (!isAcceptedComputerNotarization(notarization)) {
        fail('Apple rejected the Computer notarization submission', notarization);
    }
    console.log(`Apple notarization accepted: ${notarization.id}`);
    verifyAppleSignature(artifactPath, input);
    return archivePath;
}

export function isAcceptedComputerNotarization(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        value.status === 'Accepted'
    );
}

export function verifyAppleSignature(artifactPath, input) {
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', artifactPath]);
    const result = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', artifactPath], {
        encoding: 'utf8',
    });
    const details = `${result.stdout}\n${result.stderr}`;
    if (
        result.status !== 0 ||
        !hasExactLine(details, `TeamIdentifier=${input.appleTeamId}`) ||
        !hasExactLine(details, `Authority=${input.appleSigningIdentity}`)
    ) {
        fail('Computer Apple signing identity does not match release configuration');
    }
}

function hasExactLine(output, expected) {
    return output.split(/\r?\n/u).includes(expected);
}

function run(command, args, env = process.env) {
    execFileSync(command, args, { cwd: repoRoot, env, stdio: 'inherit' });
}

function runJson(command, args, env = process.env) {
    const output = execFileSync(command, args, {
        cwd: repoRoot,
        encoding: 'utf8',
        env,
        stdio: ['inherit', 'pipe', 'inherit'],
    });
    return JSON.parse(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    fail('Use bun run computer:release -- --dry-run <version>.');
}
