import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const runId = process.env.TAVERN_E2E_RUN_ID ?? 'default';
const agentModel = process.env.TAVERN_AGENT_MODEL ?? 'tavern-e2e-fake';
const agentProvider = process.env.TAVERN_AGENT_PROVIDER ?? 'openai-compatible';
const runtimePort = Number.parseInt(process.env.TAVERN_RUNTIME_PORT ?? '18790', 10);
const serverPort = Number.parseInt(process.env.TAVERN_SERVER_PORT ?? '8081', 10);
const grottoServerPort = Number.parseInt(process.env.GROTTO_SERVER_PORT ?? '8091', 10);
const websitePort = Number.parseInt(process.env.TAVERN_WEBSITE_PORT ?? '3101', 10);
const runtimeWebServerTimeoutMs = Number.parseInt(
    process.env.TAVERN_RUNTIME_WEBSERVER_TIMEOUT_MS ?? '180000',
    10
);
const mentionPluginRoot = fileURLToPath(new URL('./e2e/fixtures/codex-plugins/', import.meta.url));

export default defineConfig({
    fullyParallel: false,
    reporter: 'list',
    testDir: process.env.TAVERN_E2E_TEST_DIR ?? './e2e/tests',
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
            command: [
                'NODE_ENV=development',
                `TAVERN_E2E_RUN_ID=${runId}`,
                `TAVERN_RUNTIME_PORT=${runtimePort}`,
                `TAVERN_AGENT_MODEL=${agentModel}`,
                `TAVERN_AGENT_PROVIDER=${agentProvider}`,
                'TAVERN_AGENT_BASE_URL=http://127.0.0.1:1/v1',
                // A fake key keeps the OpenAI provider live so the curated
                // model catalog stays available without reading the repo .env;
                // turn execution itself runs the fake harness either way.
                'TAVERN_AGENT_API_KEY=tavern-e2e-fake-key',
                // Hermetic catalog: never ride a host Claude Code login, so
                // Claude models stay out of Available Models on any machine.
                'TAVERN_AGENT_CLAUDE_CODE_HOST_LOGIN=0',
                'bun e2e/start-tavern-runtime.ts',
            ].join(' '),
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: runtimeWebServerTimeoutMs,
            url: `http://127.0.0.1:${runtimePort}/capabilities`,
        },
        {
            command: `TAVERN_E2E_RUN_ID=${runId} SERVER_PORT=${serverPort} APP_ORIGIN=http://127.0.0.1:${websitePort} TAVERN_RUNTIME_URL=http://127.0.0.1:${runtimePort} TAVERN_MENTION_CODEX_PLUGIN_ROOT=${mentionPluginRoot} bun e2e/start-tavern-server.ts`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${serverPort}/healthz`,
        },
        {
            // The hosted Grotto Server is its own process with its own
            // PostgreSQL and Clerk instance; the local sidecar above keeps its
            // SQLite database and legacy router.
            command: `TAVERN_E2E_RUN_ID=${runId} GROTTO_SERVER_PORT=${grottoServerPort} APP_ORIGIN=http://127.0.0.1:${websitePort} exec bun e2e/start-grotto-server.ts`,
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
            command: `VITE_CLERK_PUBLISHABLE_KEY= VITE_SERVER_ORIGIN=http://127.0.0.1:${serverPort} VITE_GROTTO_SERVER_ORIGIN=http://127.0.0.1:${grottoServerPort} TAVERN_WEBSITE_PORT=${websitePort} TAVERN_SERVER_PORT=${serverPort} bun run dev -- --host 127.0.0.1 --port ${websitePort}`,
            reuseExistingServer: false,
            stderr: 'pipe',
            stdout: 'pipe',
            timeout: 30_000,
            url: `http://127.0.0.1:${websitePort}`,
        },
    ];
}
