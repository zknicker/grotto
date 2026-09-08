// Contact sheet for one design-battery run: every captured item in dark and
// light, inlined so the file can be opened or shared on its own.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeContactSheet({ captures, chatId, outDir, runLabel, stamp }) {
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

    const sheetPath = path.join(outDir, 'contact-sheet.html');
    await writeFile(sheetPath, html);
    return sheetPath;
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
