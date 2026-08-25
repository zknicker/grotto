#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
    appStoreConnectAuthenticationArgs,
    appStoreConnectExportOptions,
    assertIOSReleaseDecision,
    parseIOSReleaseArgs,
} from './ios-release-contract.mjs';
import { fail, readJson, repoRoot } from './release-utils.mjs';

const iosRoot = path.join(repoRoot, 'apps', 'ios-swift');
const projectPath = path.join(iosRoot, 'Grotto.xcodeproj');
const args = parseArgs();

if (args.help) {
    printUsage();
    process.exit(0);
}

await main(args);

async function main(input) {
    const decision = await readJson('release-surfaces.json');
    assertIOSReleaseDecision(decision, input.version, input.buildNumber);
    assertCommand('xcodebuild');
    assertCommand('xcodegen');
    verifyGeneratedProject();

    if (input.dryRun) {
        run('xcodebuild', buildArguments(input));
        console.log(`iOS ${input.version} (${input.buildNumber}) dry run passed`);
        return;
    }

    const teamId = process.env.IOS_DEVELOPMENT_TEAM ?? process.env.APPLE_TEAM_ID;
    if (!teamId) {
        fail('IOS_DEVELOPMENT_TEAM or APPLE_TEAM_ID is required for an iOS release');
    }

    const authentication = appStoreConnectAuthenticationArgs();
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'grotto-ios-release-'));
    const archivePath = path.join(outputRoot, 'Grotto.xcarchive');
    const exportPath = path.join(outputRoot, 'export');
    const exportOptionsPath = path.join(outputRoot, 'ExportOptions.plist');
    writeFileSync(exportOptionsPath, appStoreConnectExportOptions(teamId), 'utf8');

    run('xcodebuild', [
        '-project',
        projectPath,
        '-scheme',
        'Grotto',
        '-configuration',
        'Release',
        '-destination',
        'generic/platform=iOS',
        '-archivePath',
        archivePath,
        '-allowProvisioningUpdates',
        ...authentication,
        'archive',
        `DEVELOPMENT_TEAM=${teamId}`,
        `MARKETING_VERSION=${input.version}`,
        `CURRENT_PROJECT_VERSION=${input.buildNumber}`,
    ]);
    run('xcodebuild', [
        '-exportArchive',
        '-archivePath',
        archivePath,
        '-exportPath',
        exportPath,
        '-exportOptionsPlist',
        exportOptionsPath,
        '-allowProvisioningUpdates',
        ...authentication,
    ]);

    console.log(`Uploaded iOS ${input.version} (${input.buildNumber}) to App Store Connect`);
    console.log('Wait for Apple processing, then add the build to the internal TestFlight group.');
}

function parseArgs() {
    try {
        return parseIOSReleaseArgs(process.argv.slice(2));
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }
}

function printUsage() {
    console.log(
        [
            'Usage: bun run ios:release <version> --build-number <number> [--dry-run]',
            '',
            'Dry run: verifies the generated project and performs an unsigned Release build.',
            'Release: archives and uploads the declared build to App Store Connect/TestFlight.',
        ].join('\n')
    );
}

function buildArguments(input) {
    return [
        '-project',
        projectPath,
        '-scheme',
        'Grotto',
        '-configuration',
        'Release',
        '-destination',
        'generic/platform=iOS Simulator',
        '-derivedDataPath',
        path.join(tmpdir(), 'grotto-ios-dry-run'),
        'build',
        'CODE_SIGNING_ALLOWED=NO',
        `MARKETING_VERSION=${input.version}`,
        `CURRENT_PROJECT_VERSION=${input.buildNumber}`,
    ];
}

function verifyGeneratedProject() {
    const generatedPaths = ['apps/ios-swift/Config/Info.plist', 'apps/ios-swift/Grotto.xcodeproj'];
    assertGeneratedPathsClean(generatedPaths);
    run('xcodegen', ['generate', '--spec', 'project.yml', '--quiet'], { cwd: iosRoot });
    if (
        spawnSync('git', ['diff', '--quiet', '--', ...generatedPaths], { cwd: repoRoot }).status !==
        0
    ) {
        fail(
            'checked-in Xcode project is stale; run xcodegen generate --spec apps/ios-swift/project.yml'
        );
    }
}

function assertGeneratedPathsClean(paths) {
    if (spawnSync('git', ['diff', '--quiet', '--', ...paths], { cwd: repoRoot }).status !== 0) {
        fail('iOS generated files have uncommitted changes; commit or restore them before release');
    }
}

function assertCommand(command) {
    const result = spawnSync('which', [command], { stdio: 'ignore' });
    if (result.status !== 0) {
        fail(`${command} is required for an iOS release`);
    }
}

function run(command, commandArgs, options = {}) {
    const result = spawnSync(command, commandArgs, {
        cwd: options.cwd ?? repoRoot,
        env: process.env,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        fail(`${command} failed`, { status: result.status });
    }
}
