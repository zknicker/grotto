#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveReleaseSnapshot } from './release-snapshot.mjs';
import { readJson, repoRoot } from './release-utils.mjs';

export async function publishGrottoSnapshotInOrder(operations, content) {
    const existing = await operations.readImmutable();
    if (existing === null) {
        await operations.publishImmutable();
    } else if (existing !== content) {
        throw new Error('immutable Grotto release snapshot already contains different bytes');
    }
    if ((await operations.readImmutable()) !== content) {
        throw new Error('immutable Grotto release snapshot did not verify byte-for-byte');
    }
    await operations.promoteLatest();
    if ((await operations.readLatest()) !== content) {
        throw new Error('latest Grotto release snapshot did not verify byte-for-byte');
    }
}

export function grottoSnapshotKeys(version) {
    if (!/^\d+\.\d+\.\d+$/u.test(version)) {
        throw new Error(`invalid Grotto release version ${version}`);
    }
    return {
        immutable: `grotto/${version}.json`,
        latest: 'grotto/latest.json',
    };
}

async function main() {
    const sourceRevision = process.env.GITHUB_SHA ?? gitHead();
    const snapshot = resolveReleaseSnapshot(await readJson('releases.json'), { sourceRevision });
    const keys = grottoSnapshotKeys(snapshot.version);
    const s3Root = requiredEnv('GROTTO_RELEASE_S3_URI').replace(/\/+$/u, '');
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'grotto-release-snapshot-'));
    const snapshotPath = path.join(temporaryRoot, `${snapshot.version}.json`);
    const content = `${JSON.stringify(snapshot, null, 2)}\n`;
    await writeFile(snapshotPath, content);
    const immutable = `${s3Root}/${keys.immutable}`;
    const latest = `${s3Root}/${keys.latest}`;

    await publishGrottoSnapshotInOrder(
        {
            promoteLatest: async () => runAws(['s3', 'cp', immutable, latest]),
            publishImmutable: async () => runAws(['s3', 'cp', snapshotPath, immutable]),
            readImmutable: async () => readS3Object(immutable),
            readLatest: async () => readS3Object(latest),
        },
        content
    );
    console.log(`Published Grotto ${snapshot.version} release snapshot.`);
}

function gitHead() {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        throw new Error('could not resolve release source revision');
    }
    return result.stdout.trim();
}

function runAws(args) {
    const result = spawnSync('aws', args, { cwd: repoRoot, env: process.env, stdio: 'inherit' });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`aws ${args.join(' ')} failed`);
    }
}

function readS3Object(uri) {
    const result = spawnSync('aws', ['s3', 'cp', uri, '-'], {
        cwd: repoRoot,
        env: process.env,
        encoding: 'utf8',
    });
    if (result.status === 0) {
        return result.stdout;
    }
    if (/404|NoSuchKey|Not Found/u.test(result.stderr)) {
        return null;
    }
    throw new Error(`could not read ${uri}: ${result.stderr.trim()}`);
}

function requiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`missing ${name}`);
    }
    return value;
}

if (import.meta.main) {
    await main();
}
