import path from 'node:path';
import { defineConfig } from '@playwright/test';
import { resolveDevPorts } from '../../../scripts/dev-ports.mjs';

const repositoryRoot = path.resolve(process.cwd(), '../..');
const ports = resolveDevPorts({ repositoryRoot });

export default defineConfig({
    expect: {
        timeout: 30_000,
    },
    fullyParallel: false,
    outputDir: '../../../.context/agent-e2e/results',
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: '../../../.context/agent-e2e/report' }],
    ],
    retries: 0,
    testDir: './tests',
    timeout: 360_000,
    use: {
        baseURL: `http://localhost:${ports.websitePort}`,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    workers: 1,
});
