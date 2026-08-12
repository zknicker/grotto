// Headless smoke for the multi-window plumbing (Stage 2): launches the real Electron
// app against a plain Vite dev server and verifies that the openWindow IPC spawns a
// second BrowserWindow seeded at the requested route. No backend/runtime required —
// the shell renders sync-first. Run with node (bun stalls on the Electron inspector
// handshake): node e2e/electron-window-smoke.mjs
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { _electron } from '@playwright/test';
import electronPath from 'electron';

const websiteRoot = fileURLToPath(new URL('../', import.meta.url));
const seededRoute = '/new/electron-smoke-key';

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close((error) => (error ? reject(error) : resolve(port)));
        });
        server.on('error', reject);
    });
}

async function waitForHttp(url, deadlineMs) {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
        try {
            await fetch(url);
            return;
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }
    throw new Error(`Vite dev server never came up at ${url}`);
}

const port = await getFreePort();
const viteUrl = `http://localhost:${port}`;
const vite = spawn('bun', ['run', 'dev'], {
    cwd: websiteRoot,
    env: { ...process.env, TAVERN_WEBSITE_PORT: String(port) },
    stdio: 'ignore',
});

// Electron must not inherit the dev-port vars or its quit-cleanup would kill our Vite.
const electronEnv = { ...process.env, TAVERN_ELECTRON_DEV_URL: viteUrl };
for (const key of ['TAVERN_WEBSITE_PORT']) {
    delete electronEnv[key];
}

let app;
let failed = false;
try {
    await waitForHttp(viteUrl, 30_000);

    app = await _electron.launch({
        args: ['electron/main.cjs'],
        cwd: websiteRoot,
        env: electronEnv,
        executablePath: electronPath,
    });

    const first = await app.firstWindow();
    await first.waitForFunction(() => Boolean(window.tavernDesktop), null, { timeout: 20_000 });

    await first.evaluate((route) => window.tavernDesktop.openWindow(route), seededRoute);

    const deadline = Date.now() + 15_000;
    while (app.windows().length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const windows = app.windows();
    assert(windows.length === 2, `expected 2 windows, saw ${windows.length}`);

    const second = windows.find((page) => page !== first);
    await second.waitForLoadState('domcontentloaded');
    assert(
        second.url().includes(seededRoute),
        `second window url ${second.url()} should include ${seededRoute}`
    );

    console.log('PASS: openWindow spawned a second window seeded at', seededRoute);

    // closeWindow drops the calling window (the last-tab-close path on desktop).
    await second.waitForFunction(() => Boolean(window.tavernDesktop), null, { timeout: 20_000 });
    await second.evaluate(() => window.tavernDesktop.closeWindow());
    await waitForWindowCount(app, 1);
    assert(
        app.windows().length === 1,
        `expected 1 window after close, saw ${app.windows().length}`
    );
    console.log('PASS: closeWindow closed the second window');

    // Tear-off: start spawns a cursor-following window; cancel closes it. (finish is
    // cursor-position-dependent — it re-attaches over a strip — so it's exercised by
    // manual testing rather than asserted here.)
    await first.evaluate((route) => window.tavernDesktop.tearOffStart(route), seededRoute);
    await waitForWindowCount(app, 2);
    await first.evaluate(() => window.tavernDesktop.tearOffCancel());
    await waitForWindowCount(app, 1);
    assert(app.windows().length === 1, 'tear-off cancel should leave 1 window');
    console.log('PASS: tearOffStart + tearOffCancel spawned then closed the window');

    // Self-move: moving a lone-tab window follows the cursor; with no other window under
    // it, releasing just leaves the window in place (no spawn, no merge, no close).
    await first.evaluate((route) => window.tavernDesktop.selfMoveStart(route), seededRoute);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await first.evaluate(() => window.tavernDesktop.selfMoveFinish());
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert(app.windows().length === 1, 'self-move with no target should keep the single window');
    console.log('PASS: selfMoveStart + selfMoveFinish kept the lone window');
} catch (error) {
    failed = true;
    console.error('FAIL:', error instanceof Error ? error.message : error);
} finally {
    await app?.close().catch(() => {});
    vite.kill('SIGTERM');
}

process.exit(failed ? 1 : 0);

async function waitForWindowCount(app, count) {
    const deadline = Date.now() + 15_000;
    while (app.windows().length !== count && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
