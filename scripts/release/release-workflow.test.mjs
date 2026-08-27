import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(
    path.join(repositoryRoot, '.github', 'workflows', 'release.yml'),
    'utf8'
);

const jobBlock = (jobId) => {
    const match = workflow.match(new RegExp(`\\n  ${jobId}:\\n([\\s\\S]*?)(?=\\n  [a-z_]+:\\n|$)`));
    assert.ok(match, `missing workflow job ${jobId}`);
    return match[1];
};

test('Release is ledger-triggered and validates pull requests without publishing', () => {
    assert.match(workflow, /^name: Release$/m);
    assert.match(workflow, /pull_request:\n {4}paths:\n {6}- releases\.json/);
    assert.match(workflow, /push:\n {4}branches:\n {6}- main\n {4}paths:\n {6}- releases\.json/);
    assert.doesNotMatch(workflow, /^\s+workflow_dispatch:/m);
    assert.match(workflow, /github\.event_name == 'push'/);
    assert.match(workflow, /node scripts\/release\/changed-release\.mjs/);
    assert.match(workflow, /--before "\x24\{BEFORE_SHA\}"/);
    assert.match(workflow, /--after "\x24\{AFTER_SHA\}"/);
});

test('the plan preserves the exact detector contract and fails closed', () => {
    const plan = jobBlock('plan');
    assert.match(plan, /plan: \x24\{\{ steps\.release_plan\.outputs\.plan \}\}/);
    assert.match(plan, /assertExactKeys\(plan, \['initialLedgerMigration', 'targets'\]/);
    assert.match(plan, /assertExactKeys\(plan\.targets, targetNames/);
    assert.match(plan, /typeof plan\.initialLedgerMigration !== 'boolean'/);
    assert.match(plan, /typeof plan\.targets\[target\] !== 'boolean'/);
    assert.match(plan, /initial ledger migration must not request a release publication target/);
    assert.match(plan, /plan<<\x24\{delimiter\}/);
    assert.match(plan, /initial_ledger_migration=\x24\{plan\.initialLedgerMigration\}/);
    assert.match(plan, /publish_\x24\{target\}=\x24\{plan\.targets\[target\]\}/);
    assert.match(plan, /releases\.json must be a non-empty oldest-first array/);
    assert.match(plan, /read_semver '\.\[-1\]\.version' 'version'/);
    assert.match(plan, /read_semver '\.\[-1\]\.targets\.computer' 'targets\.computer'/);
    assert.match(plan, /read_semver '\.\[-1\]\.targets\.ios\.version' 'targets\.ios\.version'/);
    assert.match(
        plan,
        /read_required_value '\.\[-1\]\.targets\.ios\.buildNumber' 'targets\.ios\.buildNumber'/
    );
    assert.match(plan, /assert_target_value '\.\[-1\]\.targets\.server' 'targets\.server'/);
    assert.match(plan, /assert_target_value '\.\[-1\]\.targets\.app' 'targets\.app'/);
    assert.match(plan, /latest releases\.json entry has undecided/);
    assert.match(plan, /initialLedgerMigration \| tostring/);
    assert.match(plan, /targets\.computer \| tostring/);
});

test('target jobs use ledger-derived arguments and the required hosted runners', () => {
    const computer = jobBlock('publish_computer');
    const app = jobBlock('publish_app');
    const ios = jobBlock('upload_ios');
    const server = jobBlock('publish_server');
    const finalizer = jobBlock('finalize_release');

    assert.match(computer, /name: Publish Computer/);
    assert.match(computer, /runs-on: macos-15/);
    assert.match(computer, /needs\.plan\.outputs\.publish_computer == 'true'/);
    assert.match(computer, /needs\.plan\.outputs\.initial_ledger_migration == 'false'/);
    assert.match(computer, /bun run computer:release "\x24\{COMPUTER_VERSION\}"/);

    assert.match(app, /name: Publish App/);
    assert.match(app, /runs-on: macos-15/);
    assert.match(app, /needs\.plan\.outputs\.publish_app == 'true'/);
    assert.match(app, /run: bun run publish:desktop$/m);
    assert.match(app, /uses: actions\/upload-artifact@v4/);
    assert.match(app, /name: grotto-app-release-assets/);
    assert.match(app, /latest-mac\.yml/);
    assert.match(app, /Grotto_[^\n]+_arm64\.dmg/);
    assert.match(app, /Grotto_[^\n]+_arm64\.zip/);
    assert.match(app, /Grotto_[^\n]+_arm64\.dmg\.blockmap/);
    assert.match(app, /Grotto_[^\n]+_arm64\.zip\.blockmap/);
    assert.match(app, /if-no-files-found: error/);
    assert.match(app, /retention-days: 1/);
    assert.ok(
        app.indexOf('uses: actions/upload-artifact@v4') >
            app.indexOf('run: bun run publish:desktop')
    );

    assert.match(ios, /name: Upload iOS/);
    assert.match(ios, /runs-on: macos-15/);
    assert.match(ios, /needs\.plan\.outputs\.publish_ios == 'true'/);
    assert.match(
        ios,
        /bun run ios:release "\x24\{IOS_VERSION\}" --build-number "\x24\{IOS_BUILD_NUMBER\}"/
    );

    assert.match(server, /name: Publish Server/);
    assert.match(server, /runs-on: ubuntu-latest/);
    assert.match(server, /always\(\)/);
    assert.match(server, /needs\.publish_computer/);
    assert.match(server, /needs\.publish_app/);
    assert.match(server, /needs\.upload_ios/);
    assert.match(server, /uses: actions\/download-artifact@v4/);
    assert.match(server, /name: grotto-app-release-assets/);
    assert.match(server, /path: apps\/website\/electron-dist/);
    assert.ok(
        server.indexOf('uses: actions/download-artifact@v4') <
            server.indexOf('run: bun run release:publish')
    );
    assert.match(server, /run: bun run release:publish$/m);
    assert.equal((workflow.match(/^\s+bun run setup:worktree$/gm) ?? []).length, 4);
    assert.equal(
        (
            workflow.match(
                /CI_OP_TOKEN: \x24\{\{ secrets\.GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN \}\}/g
            ) ?? []
        ).length,
        4
    );

    assert.match(finalizer, /name: Finalize release/);
    assert.match(finalizer, /runs-on: ubuntu-latest/);
    assert.match(finalizer, /always\(\)/);
    assert.match(finalizer, /needs\.plan\.outputs\.initial_ledger_migration == 'false'/);
    assert.match(finalizer, /needs\.plan\.outputs\.publish_computer == 'true'/);
    assert.match(finalizer, /needs\.plan\.outputs\.publish_app == 'true'/);
    assert.match(finalizer, /needs\.plan\.outputs\.publish_ios == 'true'/);
    assert.match(finalizer, /needs\.plan\.outputs\.publish_server == 'true'/);
    assert.doesNotMatch(workflow, /bun run release:finalize/);
    assert.doesNotMatch(workflow, /runs-on: macos-(latest|14|13)/);
});

test('release credentials and Apple material stay scoped and temporary', () => {
    const secretNames = [...workflow.matchAll(/\x24\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)].map(
        (match) => match[1]
    );
    assert.deepEqual([...new Set(secretNames)].sort(), [
        'GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN',
        'GH_RELEASE_AGENT_TOOLING_OP_TOKEN',
    ]);
    assert.match(
        workflow,
        /CI_OP_TOKEN: \x24\{\{ secrets\.GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN \}\}/
    );
    assert.match(
        workflow,
        /RELEASE_AGENT_TOOLING_OP_TOKEN: \x24\{\{ secrets\.GH_RELEASE_AGENT_TOOLING_OP_TOKEN \}\}/
    );
    assert.doesNotMatch(
        workflow,
        /CI_OP_TOKEN: \x24\{\{ secrets\.GH_RELEASE_AGENT_TOOLING_OP_TOKEN \}\}/
    );
    assert.doesNotMatch(
        workflow,
        /RELEASE_AGENT_TOOLING_OP_TOKEN: \x24\{\{ secrets\.GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN \}\}/
    );
    assert.doesNotMatch(workflow, /CI_OP_TOKEN: \x24\{\{ secrets\.CI_OP_TOKEN \}\}/);

    assert.match(workflow, /GROTTO_RELEASE_APPLE_CERTIFICATES_P12_BASE64/);
    assert.match(workflow, /GROTTO_RELEASE_APPLE_CERTIFICATES_PASSWORD/);
    assert.match(workflow, /GROTTO_RELEASE_APP_STORE_CONNECT_PRIVATE_KEY/);
    assert.match(workflow, /APPLE_API_KEY_ID/);
    assert.match(workflow, /APPLE_API_ISSUER/);
    assert.match(workflow, /AuthKey_\x24\{APPLE_API_KEY_ID\}\.p8/);
    assert.match(workflow, /APPLE_API_KEY_PATH=\x24\{api_key_path\}/);
    assert.match(workflow, /security create-keychain/);
    assert.match(workflow, /security import "\x24\{certificate_path\}".*-f pkcs12/s);
    assert.match(workflow, /security set-key-partition-list/);
    assert.match(workflow, /security find-identity -v -p codesigning/);
    assert.match(workflow, /Developer ID Application:/);
    assert.match(workflow, /Apple Distribution:/);
    assert.equal((workflow.match(/if: \x24\{\{ always\(\) \}\}/g) ?? []).length, 3);
    assert.match(workflow, /security delete-keychain/);
    assert.match(workflow, /rm -f "\x24\{material_path\}"/);
    assert.doesNotMatch(workflow, /PROVISIONING_PROFILE/);
    assert.doesNotMatch(workflow, /APPLE_IOS_PROVISIONING_PROFILE_BASE64/);
});

test('finalization verifies the merged SHA, public release assets, or Computer descriptor', () => {
    const finalizer = jobBlock('finalize_release');
    assert.match(finalizer, /git\/ref\/tags\/\x24\{tag_name\}/);
    assert.match(finalizer, /git\/tags\/\x24\{object_sha\}/);
    assert.match(finalizer, /releases\/tags\/\x24\{tag_name\}/);
    assert.match(finalizer, /\.draft == false/);
    assert.match(finalizer, /\.prerelease == false/);
    assert.match(finalizer, /\.published_at != null/);
    assert.match(finalizer, /\.assets \| length/);
    assert.match(finalizer, /grotto-server-\x24\{release_id\}-aarch64-apple-darwin\.tar\.gz/);
    assert.match(finalizer, /if \[\[ "\x24\{PUBLISH_APP\}" == 'true' \]\]/);
    assert.match(finalizer, /Grotto_\x24\{RELEASE_VERSION\}_arm64\.dmg/);
    assert.match(finalizer, /Grotto_\x24\{RELEASE_VERSION\}_arm64\.zip/);
    assert.match(finalizer, /Grotto_\x24\{RELEASE_VERSION\}_arm64\.dmg\.blockmap/);
    assert.match(finalizer, /Grotto_\x24\{RELEASE_VERSION\}_arm64\.zip\.blockmap/);
    assert.match(finalizer, /latest-mac\.yml/);
    assert.match(finalizer, /computer-v\x24\{COMPUTER_VERSION\}/);
    assert.match(
        finalizer,
        /https:\/\/releases\.grotto\.sh\/computer\/\x24\{COMPUTER_VERSION\}\/release\.json/
    );
    assert.match(finalizer, /\.release\.sourceRevision == \$expected_revision/);
    assert.match(finalizer, /Production Server deployment remains an explicit action/);
});
