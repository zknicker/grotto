#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultOrigin = 'https://grotto.sh';

export async function verifyHostedGrotto({
    expectedVersion,
    origin = defaultOrigin,
    attempts = 12,
    retryDelayMs = 5000,
    fetchImpl = fetch,
    sleepImpl = sleep,
}) {
    if (!/^\d+\.\d+\.\d+$/u.test(expectedVersion)) {
        throw new Error('expected hosted Grotto version must be X.Y.Z');
    }
    const baseUrl = new URL(origin);
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await verifyAttempt({ baseUrl, expectedVersion, fetchImpl });
            return;
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await sleepImpl(retryDelayMs);
            }
        }
    }
    throw new Error(`hosted Grotto did not serve ${expectedVersion}: ${errorMessage(lastError)}`);
}

async function verifyAttempt({ baseUrl, expectedVersion, fetchImpl }) {
    const health = await fetchResponse(fetchImpl, new URL('/healthz', baseUrl));
    const healthPayload = await health.json();
    if (healthPayload?.status !== 'ok') {
        throw new Error('public Server health is not ok');
    }

    const app = await fetchResponse(fetchImpl, new URL('/', baseUrl));
    const html = await app.text();
    if (!html.includes('id="root"')) {
        throw new Error('hosted Grotto App root is missing');
    }
    const assetPath = html.match(/\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["']/u)?.[1];
    if (!assetPath) {
        throw new Error('hosted Grotto App entry asset is missing');
    }
    const asset = await fetchResponse(fetchImpl, new URL(assetPath, baseUrl));
    const source = await asset.text();
    if (!(source.includes(`"${expectedVersion}"`) || source.includes(`'${expectedVersion}'`))) {
        throw new Error(`hosted Grotto App does not contain version ${expectedVersion}`);
    }
}

async function fetchResponse(fetchImpl, url) {
    const response = await fetchImpl(url, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
        throw new Error(`${url.pathname} returned HTTP ${response.status}`);
    }
    return response;
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

async function main() {
    await verifyHostedGrotto({
        expectedVersion: process.argv[2] ?? '',
        origin: process.argv[3] ?? defaultOrigin,
    });
    console.log(`Public Grotto Server and hosted App verified at ${process.argv[2]}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(`hosted Grotto verification error: ${errorMessage(error)}`);
        process.exitCode = 1;
    });
}
