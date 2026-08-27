import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyComputerOnlyRelease } from './computer-release-verifier.mjs';
import { verifyNormalRelease } from './github-release-verifier.mjs';

export { verifyComputerOnlyRelease, verifyNormalRelease };

export function writeReleaseSummary({ summaryPath, verification, targets }) {
    if (typeof summaryPath !== 'string' || !summaryPath) {
        throw new Error('GITHUB_STEP_SUMMARY is required for release finalization');
    }
    if (!(verification && typeof verification.message === 'string')) {
        throw new Error('release verification result is missing its message');
    }
    const targetNames = ['computer', 'app', 'ios', 'server'];
    assertRecord(targets, 'release target outcomes');
    const lines = [
        '## Coordinated release finalized',
        '',
        `${verification.message}.`,
        '',
        '| Target | Outcome |',
        '| --- | --- |',
        ...targetNames.map((target) => {
            if (targets[target] !== true && targets[target] !== false) {
                throw new Error(`release target outcome ${target} must be boolean`);
            }
            return (
                '| ' +
                capitalize(target) +
                ' | ' +
                (targets[target] ? 'published' : 'unchanged') +
                ' |'
            );
        }),
        '',
        'Production Server deployment remains an explicit action in the manual Deploy Grotto Server workflow.',
        '',
    ];
    appendFileSync(summaryPath, lines.join('\n'));
}

function assertRecord(value, label) {
    if (!(value && typeof value === 'object' && !Array.isArray(value))) {
        throw new Error(`${label} must be an object`);
    }
}

function capitalize(value) {
    return value === 'ios' ? 'iOS' : value[0].toUpperCase() + value.slice(1);
}

function requiredEnvironment(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required for release finalization`);
    }
    return value;
}

function booleanEnvironment(name) {
    const value = requiredEnvironment(name);
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    throw new Error(`${name} must be true or false`);
}

function ghApi(endpoint) {
    const output = execFileSync('gh', ['api', endpoint], {
        encoding: 'utf8',
        env: process.env,
    });
    try {
        return JSON.parse(output);
    } catch {
        throw new Error(`gh api returned malformed JSON for ${endpoint}`);
    }
}

async function main() {
    const repository = requiredEnvironment('GITHUB_REPOSITORY');
    const sourceRevision = requiredEnvironment('SOURCE_REVISION');
    const targets = {
        computer: booleanEnvironment('PUBLISH_COMPUTER'),
        app: booleanEnvironment('PUBLISH_APP'),
        ios: booleanEnvironment('PUBLISH_IOS'),
        server: booleanEnvironment('PUBLISH_SERVER'),
    };
    let verification;
    if (targets.server) {
        verification = await verifyNormalRelease({
            repository,
            sourceRevision,
            releaseVersion: requiredEnvironment('RELEASE_VERSION'),
            publishApp: targets.app,
            ghApi,
        });
    } else if (targets.computer) {
        verification = await verifyComputerOnlyRelease({
            repository,
            sourceRevision,
            computerVersion: requiredEnvironment('COMPUTER_VERSION'),
            ghApi,
        });
    } else {
        throw new Error('release finalization has no supported Server or Computer publication');
    }
    writeReleaseSummary({
        summaryPath: requiredEnvironment('GITHUB_STEP_SUMMARY'),
        verification,
        targets,
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(
            'release finalization error: ' +
                (error instanceof Error ? error.message : String(error))
        );
        process.exitCode = 1;
    });
}
