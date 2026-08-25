#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
process.env.GROTTO_ELECTRON_NOTARIZE = '0';

runElectronBuilder([
    '--config',
    'electron-builder.config.cjs',
    '--mac',
    '--config.mac.identity=-',
    '--config.mac.hardenedRuntime=false',
    '--publish',
    'never',
]);

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
