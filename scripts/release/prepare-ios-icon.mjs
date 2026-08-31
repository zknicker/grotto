#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectIOSIconArtifact } from './ios-icon-artifact.mjs';
import { fail, repoRoot } from './release-utils.mjs';

const outputDirectory = path.resolve(process.argv[2] ?? 'build/ios-icon');
const stagedDirectory = mkdtempSync(path.join(tmpdir(), 'grotto-ios-icon-'));
const stagedIcon = path.join(stagedDirectory, 'mac-icon.icon');
const requiredXcodeBuild = '27A5237l';

mkdirSync(outputDirectory, { recursive: true });
cpSync(path.join(repoRoot, 'assets', 'mac-icon.icon'), stagedIcon, { recursive: true });

const xcodeVersion = run('xcodebuild', ['-version'], { captureOutput: true });
if (!xcodeVersion.includes(`Build version ${requiredXcodeBuild}`)) {
    fail(`iOS icon compilation requires Xcode build ${requiredXcodeBuild}`, {
        xcodeVersion: xcodeVersion.trim(),
    });
}
console.log(xcodeVersion.trim());
run('xcrun', [
    'actool',
    stagedIcon,
    '--app-icon',
    'mac-icon',
    '--compile',
    outputDirectory,
    '--output-partial-info-plist',
    path.join(outputDirectory, 'assetcatalog_generated_info.plist'),
    '--minimum-deployment-target',
    '18.0',
    '--platform',
    'iphoneos',
    '--target-device',
    'iphone',
]);
inspectIOSIconArtifact(outputDirectory);
console.log(`Prepared full-fidelity iOS icon artifact at ${outputDirectory}`);

function run(command, args, { captureOutput = false } = {}) {
    const result = spawnSync(command, args, {
        cwd: repoRoot,
        encoding: captureOutput ? 'utf8' : undefined,
        env: process.env,
        stdio: captureOutput ? 'pipe' : 'inherit',
    });
    if (result.status !== 0) {
        fail(`${command} failed while preparing the iOS icon`, {
            status: result.status,
            stderr: result.stderr?.trim(),
        });
    }
    return result.stdout ?? '';
}
