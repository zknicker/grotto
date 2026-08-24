import { defineConfig } from '@playwright/test';

const runId = process.env.GROTTO_E2E_RUN_ID ?? 'default';
const grottoServerPort = Number.parseInt(process.env.GROTTO_SERVER_PORT ?? '8091', 10);
const websitePort = Number.parseInt(process.env.GROTTO_WEBSITE_PORT ?? '3101', 10);

export default defineConfig({
    fullyParallel: false,
    reporter: 'list',
    testDir: process.env.GROTTO_E2E_TEST_DIR ?? './e2e/tests',
    use: {
        baseURL: `http://127.0.0.1:${websitePort}`,
        trace: 'retain-on-failure',
    },
    webServer: buildWebServers(),
    workers: 1,
});

function buildWebServers() {
    return [
        {
            // Browser E2E exercises the current hosted product boundary. Real
            // Computer/model turns live in the opt-in Agent E2E lane.
            command: `GROTTO_E2E_RUN_ID=${runId} GROTTO_SERVER_PORT=${grottoServerPort} APP_ORIGIN=http://127.0.0.1:${websitePort} exec bun e2e/start-grotto-server.ts`,
            // Let the process stop its throwaway PostgreSQL cluster and remove
            // its data directory instead of being killed outright.
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${grottoServerPort}/healthz`,
        },
        {
            // VITE_CLERK_PUBLISHABLE_KEY is forced empty so e2e always runs the
            // keyless signed-out dev mode, even when .env.local has a key.
            command: `VITE_CLERK_PUBLISHABLE_KEY= VITE_GROTTO_SERVER_ORIGIN=http://127.0.0.1:${grottoServerPort} GROTTO_WEBSITE_PORT=${websitePort} bun run dev -- --host 127.0.0.1 --port ${websitePort}`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${websitePort}`,
        },
    ];
}
