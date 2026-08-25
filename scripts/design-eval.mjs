// Design battery dev tool (PRD-86). Drives the fixed battery of visual
// prompts through a RUNNING dev stack (bun run dev) as real model
// turns, screenshots each rendered result in dark and light themes, and
// writes a contact sheet for human critique against
// scripts/design-battery/RUBRIC.md.
//
// This is a dev tool, not CI: each run costs real model turns, and the
// verdict on the output is the operator's.
//
// Usage: bun run eval:design [--model <provider>/<model>] [--thinking <level>]
//        [--only <slug>] [--reuse-chats] [--server URL] [--keep-model]
//
// --model sets the battery agent's model for the run (e.g. claude/claude-
// opus-4-8, codex/gpt-5.6-sol) and restores the previous model afterwards
// unless --keep-model is passed. --thinking sets the agent's thinking
// default for the run the same way (kimi/k3 wants max — that is what
// kimi.com runs). The battery chat is left in place for transcript
// inspection; rerun with --reuse-chats to recycle it.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { designBattery } from './design-battery/battery.mjs';
import { resolveDevPorts } from './dev-ports.mjs';
import { assert, createEvalHarness, InfraError, sleep } from './eval-harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const websiteRequire = createRequire(path.join(here, '../apps/website/package.json'));
const { chromium } = websiteRequire('@playwright/test');

const harness = createEvalHarness({ evalName: 'designeval' });
const { requireAgents, send, stamp, trpc, waitForQuiet } = harness;

const modelFlag = flagValue('--model');
const thinkingFlag = flagValue('--thinking');
const onlyFilter = flagValue('--only');
const keepModel = process.argv.includes('--keep-model');

const items = designBattery.filter((item) => !onlyFilter || item.slug.includes(onlyFilter));
assert(items.length > 0, `--only ${onlyFilter} matched no battery items`);

const [agent] = await requireAgents(1);
const originalModel = await currentModelRef(agent.id);
const originalThinking = await currentThinkingDefault(agent.id);

if (modelFlag) {
    process.stdout.write(`setting ${agent.name} model: ${originalModel} -> ${modelFlag}\n`);
    await trpc('agent.updateModel', { agentId: agent.id, modelRef: modelFlag });
}
if (thinkingFlag) {
    process.stdout.write(
        `setting ${agent.name} thinking: ${originalThinking ?? 'default'} -> ${thinkingFlag}\n`
    );
    await trpc('agent.updateThinkingDefault', {
        agentId: agent.id,
        thinkingDefault: thinkingFlag,
    });
}
if (modelFlag || thinkingFlag) {
    await trpc('agent.resetSession', { agentId: agent.id });
}

const runModel = modelFlag ?? originalModel;
const runLabel = thinkingFlag ? `${runModel}-${thinkingFlag}` : runModel;
const outDir = path.join(
    here,
    'design-battery/output',
    `${stamp}-${runLabel.replaceAll(/[^a-zA-Z0-9.-]+/gu, '-')}`
);
await mkdir(outDir, { recursive: true });

const chatId = await harness.createChat(`Design battery ${stamp}`, [agent.id]);
process.stdout.write(`battery chat: ${chatId} (${items.length} items, model ${runLabel})\n`);

// The main dev vite serves the Clerk-gated app; captures run against a
// second, keyless vite (the e2e trick) on the dev-port group's spare port,
// pointed at the same running server.
const captureVite = await startCaptureVite();
const browser = await chromium.launch();
const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { height: 1000, width: 1440 },
});
const captures = [];

try {
    for (const item of items) {
        const startedAt = Date.now();
        process.stdout.write(`\n▶ ${item.slug}\n`);
        await generateItem(item);
        const files = await captureItem(item);
        captures.push({ files, item, seconds: Math.round((Date.now() - startedAt) / 1000) });
        process.stdout.write(`  ✓ captured (${captures.at(-1).seconds}s)\n`);
    }
} finally {
    await browser.close();
    captureVite.child.kill();
    if (modelFlag && !keepModel) {
        await trpc('agent.updateModel', { agentId: agent.id, modelRef: originalModel }).catch(
            (error) => process.stdout.write(`model restore failed: ${error}\n`)
        );
    }
    if (thinkingFlag && !keepModel) {
        await trpc('agent.updateThinkingDefault', {
            agentId: agent.id,
            thinkingDefault: originalThinking,
        }).catch((error) => process.stdout.write(`thinking restore failed: ${error}\n`));
    }
}

await writeContactSheet();
process.stdout.write(`\n${captures.length}/${items.length} items captured\n`);
process.stdout.write(`output: ${path.relative(process.cwd(), outDir)}\n`);
process.stdout.write(`chat kept for inspection: ${chatId}\n`);

async function startCaptureVite() {
    const ports = resolveDevPorts();
    // Each checkout owns four consecutive dev ports (website, server,
    // runtime, spare); the capture vite takes the spare.
    const capturePort = Number(ports.websitePort) + 3;
    const logPath = path.join(outDir, 'capture-vite.log');
    const log = await import('node:fs').then((fs) => fs.openSync(logPath, 'w'));
    const child = spawn(
        'bun',
        ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(capturePort)],
        {
            cwd: path.join(here, '../apps/website'),
            env: {
                ...process.env,
                NODE_ENV: 'development',
                GROTTO_WEBSITE_PORT: String(capturePort),
                VITE_CLERK_PUBLISHABLE_KEY: '',
                VITE_SERVER_ORIGIN: `http://127.0.0.1:${ports.serverPort}`,
            },
            stdio: ['ignore', log, log],
        }
    );
    let exited = false;
    child.on('exit', () => {
        exited = true;
    });
    const url = `http://127.0.0.1:${capturePort}`;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && !exited) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                process.stdout.write(`capture vite ready at ${url}\n`);
                return { child, url };
            }
        } catch {
            // Not listening yet.
        }
        await sleep(500);
    }
    child.kill();
    throw new Error(`capture vite never became ready (see ${logPath})`);
}

// A single failed turn ("failed to produce a reply", transient provider
// errors) gets one retry so a long battery run survives model flakiness.
async function generateItem(item) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        await send(chatId, item.prompt);
        // The failure banner clears once the retried turn's response row
        // lands; give dispatch a beat so waitForQuiet reads the new turn.
        if (attempt > 1) {
            await sleep(3000);
        }
        try {
            // Max-thinking turns legitimately run past ten minutes; the
            // runtime's own watchdog is the real cap, so wait generously.
            await waitForQuiet(chatId, 8000, 1_800_000);
            return;
        } catch (error) {
            if (attempt === 2 || !(error instanceof InfraError)) {
                throw error;
            }
            process.stdout.write(`  ↻ retrying: ${String(error).slice(0, 160)}\n`);
        }
    }
}

async function captureItem(item) {
    await page.goto(`${captureVite.url}/chats/${chatId}`, { waitUntil: 'domcontentloaded' });
    await sleep(3500);
    await expandCollapsedVisual();
    if (item.kind === 'artifact') {
        await openLatestArtifact();
    }

    const files = {};
    for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
        }, theme);
        await sleep(1200);
        const file = `${item.slug}-${theme}.png`;
        await screenshotLatest(item, path.join(outDir, file));
        files[theme] = file;
    }
    await page.evaluate(() => {
        document.documentElement.dataset.theme = 'dark';
    });
    return files;
}

// Visuals taller than the collapse threshold render with a fade and a
// "Show all" toggle; expand so the screenshot shows the full output.
async function expandCollapsedVisual() {
    const toggle = page.getByRole('button', { exact: true, name: 'Show all' }).last();
    if (await toggle.isVisible().catch(() => false)) {
        await toggle.click();
        await sleep(600);
    }
}

async function openLatestArtifact() {
    const card = page.getByRole('button').filter({ hasText: '.html' }).last();
    if (await card.isVisible().catch(() => false)) {
        await card.click();
        await sleep(2500);
    } else {
        process.stdout.write('  ! no artifact card found; capturing transcript instead\n');
    }
}

async function screenshotLatest(item, filePath) {
    if (item.kind === 'artifact') {
        await page.screenshot({ path: filePath });
        return;
    }
    const card = page
        .locator('div.overflow-hidden.rounded-xl', { has: page.locator('iframe') })
        .last();
    if (await card.isVisible().catch(() => false)) {
        await card.screenshot({ path: filePath });
        return;
    }
    // Non-iframe result (e.g. the model chose a catalog widget): capture the
    // transcript viewport so the miss is still reviewable.
    await page.screenshot({ path: filePath });
}

async function writeContactSheet() {
    const sections = [];
    for (const capture of captures) {
        const images = [];
        for (const [theme, file] of Object.entries(capture.files)) {
            const data = await readFile(path.join(outDir, file));
            images.push(
                `<figure><img alt="${capture.item.slug} ${theme}" src="data:image/png;base64,${data.toString('base64')}"/><figcaption>${theme}</figcaption></figure>`
            );
        }
        sections.push(`<section>
<h2>${capture.item.slug} <span class="kind">${capture.item.kind}</span></h2>
<p class="prompt">${escapeHtml(capture.item.prompt)}</p>
<div class="shots">${images.join('')}</div>
</section>`);
    }

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Design battery — ${escapeHtml(runLabel)} — ${stamp}</title>
<style>
body { margin: 0 auto; max-width: 1500px; padding: 32px 24px; background: #16130f; color: #eee;
  font: 14px/1.5 -apple-system, sans-serif; }
h1 { font-size: 20px; font-weight: 500; }
h2 { font-size: 15px; font-weight: 500; margin: 0 0 4px; }
.kind { color: #999; font-weight: 400; margin-left: 8px; }
.meta, .prompt { color: #999; margin: 0 0 12px; }
section { border-top: 1px solid #333; margin-top: 24px; padding-top: 20px; }
.shots { display: flex; flex-wrap: wrap; gap: 16px; }
figure { flex: 1 1 480px; margin: 0; min-width: 320px; }
figure img { border: 1px solid #333; border-radius: 8px; width: 100%; }
figcaption { color: #999; font-size: 12px; margin-top: 4px; }
</style></head><body>
<h1>Design battery</h1>
<p class="meta">model ${escapeHtml(runLabel)} · ${stamp} · chat ${chatId} · rubric: scripts/design-battery/RUBRIC.md</p>
${sections.join('\n')}
</body></html>`;

    await writeFile(path.join(outDir, 'contact-sheet.html'), html);
}

async function currentModelRef(agentId) {
    const data = await trpc('model.list');
    const match = (data?.agents ?? []).find((candidate) => candidate.agentId === agentId);
    assert(match?.modelRef, `agent ${agentId} has no resolved model`);
    return match.modelRef;
}

async function currentThinkingDefault(agentId) {
    const data = await trpc('model.list');
    const match = (data?.agents ?? []).find((candidate) => candidate.agentId === agentId);
    return match?.overrideThinkingDefault ?? null;
}

function flagValue(name) {
    const index = process.argv.indexOf(name);
    return index !== -1 ? (process.argv[index + 1] ?? null) : null;
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
