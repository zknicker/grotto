import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeReleaseSummary } from './verify-release.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');
const environmentSchema = readFileSync(path.join(repositoryRoot, '.env.schema'), 'utf8');
const dependencyAction = readFileSync(
    path.join(repositoryRoot, '.github/actions/setup-release-dependencies/action.yml'),
    'utf8'
);
const setupApple = path.join(repositoryRoot, 'scripts/release/setup-apple-material.sh');
const cleanupApple = path.join(repositoryRoot, 'scripts/release/cleanup-apple-material.sh');
const setupAppleSource = readFileSync(setupApple, 'utf8');

test('summary and Apple lifecycle helpers expose outcomes and clean temporary files', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'grotto-release-test-'));
    try {
        const summaryPath = path.join(directory, 'summary');
        writeReleaseSummary({
            summaryPath,
            verification: { message: 'verified release' },
            targets: { computer: true, app: false, ios: false, server: true },
        });
        const summary = readFileSync(summaryPath, 'utf8');
        assert.match(summary, /\| Computer \| published \|/);
        assert.match(summary, /\| App \| unchanged \|/);
        assert.match(summary, /manual Deploy Grotto Server workflow/);

        const setup = spawnSync('bash', [setupApple, 'computer'], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                RELEASE_AGENT_TOOLING_OP_TOKEN: 'test-token',
                GROTTO_RELEASE_APPLE_CERTIFICATES_P12_BASE64: '',
                GROTTO_RELEASE_APPLE_CERTIFICATES_PASSWORD: '',
                RUNNER_TEMP: directory,
                GITHUB_ENV: path.join(directory, 'env'),
            },
        });
        assert.notEqual(setup.status, 0);
        assert.match(
            setup.stderr,
            /Missing release material GROTTO_RELEASE_APPLE_CERTIFICATES_P12_BASE64/
        );

        const certificatePath = path.join(directory, 'certificate.p12');
        const apiKeyPath = path.join(directory, 'AuthKey_TEST.p8');
        writeFileSync(certificatePath, 'temporary certificate');
        writeFileSync(apiKeyPath, 'temporary key');
        const cleanup = spawnSync('bash', [cleanupApple], {
            cwd: repositoryRoot,
            encoding: 'utf8',
            env: {
                ...process.env,
                GROTTO_RELEASE_KEYCHAIN_PATH: path.join(directory, 'missing.keychain-db'),
                GROTTO_RELEASE_CERTIFICATE_PATH: certificatePath,
                APPLE_API_KEY_PATH: apiKeyPath,
            },
        });
        assert.equal(cleanup.status, 0, cleanup.stderr);
        assert.equal(existsSync(certificatePath), false);
        assert.equal(existsSync(apiKeyPath), false);
    } finally {
        rmSync(directory, { force: true, recursive: true });
    }
});

test('Release workflow stays under the cap and preserves the operator graph', () => {
    assert.ok(workflow.split('\n').length - 1 < 300);
    assert.match(workflow, /^name: Release$/m);
    assert.match(workflow, /pull_request:[\s\S]*- releases\.json/);
    assert.match(
        workflow,
        /push:[\s\S]*branches:[\s\S]*- main[\s\S]*paths:[\s\S]*- releases\.json/
    );
    assert.match(workflow, /node scripts\/release\/release-plan\.mjs/);
    assert.match(workflow, /scripts\/release\/setup-apple-material\.sh/);
    assert.match(workflow, /scripts\/release\/cleanup-apple-material\.sh/);
    assert.match(workflow, /scripts\/release\/verify-release\.mjs/);
    for (const jobName of [
        'Publish Computer',
        'Publish App',
        'Upload iOS',
        'Publish Server',
        'Finalize release',
    ]) {
        assert.match(workflow, new RegExp(`name: ${jobName}`));
    }
    assert.equal((workflow.match(/runs-on: macos-15$/gm) ?? []).length, 3);
    assert.match(workflow, /name: Publish Computer[\s\S]*?GH_TOKEN: \$\{\{ github\.token \}\}/);
    assert.match(workflow, /bun run computer:release "\$\{COMPUTER_VERSION\}"/);
    assert.match(
        workflow,
        /bun run ios:release "\$\{IOS_VERSION\}" --build-number "\$\{IOS_BUILD_NUMBER\}"/
    );
    assert.match(workflow, /run: bun run publish:desktop/);
    assert.match(workflow, /run: bun run release:publish/);
    assert.ok(
        workflow.indexOf('actions/upload-artifact@v4') <
            workflow.indexOf('actions/download-artifact@v4')
    );
    assert.ok(
        workflow.indexOf('actions/upload-artifact@v4') <
            workflow.indexOf('run: bun run release:publish')
    );
    assert.match(workflow, /path: apps\/website\/electron-dist/);
    assert.match(workflow, /Grotto_\$\{\{ needs\.plan\.outputs\.release_version \}\}_arm64\.dmg/);
    assert.doesNotMatch(workflow, /Grotto_\*_arm64/);
    assert.match(setupAppleSource, /base64 -D/);
    assert.ok(
        workflow.indexOf('Check out release verification helpers') <
            workflow.indexOf('run: node scripts/release/verify-release.mjs')
    );
    assert.match(dependencyAction, /CI_OP_TOKEN: \$\{\{ inputs\.ci-op-token \}\}/);
    assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
    const secrets = [...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)].map(
        (match) => match[1]
    );
    assert.deepEqual([...new Set(secrets)].sort(), [
        'GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN',
        'GH_RELEASE_AGENT_TOOLING_OP_TOKEN',
    ]);
    assert.doesNotMatch(workflow, /PROVISIONING_PROFILE|release:finalize|macos-15-intel/);
});

test('release context skips development-only runtime and App values', () => {
    for (const name of [
        'GROTTO_CLERK_SECRET_KEY',
        'GROTTO_DEV_CLERK_SIGN_IN_USER_ID',
        'GROTTO_GOOGLE_OAUTH_CLIENT_ID',
        'GROTTO_GOOGLE_OAUTH_CLIENT_SECRET',
    ]) {
        const declaration = environmentSchema
            .split('\n')
            .find((line) => line.startsWith(`${name}=`));
        assert.ok(declaration, `${name} must remain declared`);
        assert.match(
            declaration,
            /^.+ifs\(eq\(\$GROTTO_RESOLVE_RELEASE_TOKENS, true\), undefined,/,
            `${name} must skip Development resolution during releases`
        );
    }
    const autoSignIn = environmentSchema
        .split('\n')
        .find((line) => line.startsWith('VITE_DEV_CLERK_AUTO_SIGN_IN='));
    assert.ok(autoSignIn, 'VITE_DEV_CLERK_AUTO_SIGN_IN must remain declared');
    assert.match(
        autoSignIn,
        /^.+ifs\(eq\(\$GROTTO_RESOLVE_RELEASE_TOKENS, true\), undefined,/,
        'release artifacts must disable development auto sign-in'
    );
});
