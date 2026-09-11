/**
 * Renders the browser favicon set in `apps/website/public/` from the real
 * `HausGhost` component, so the tab mark is the same ghost the sidebar and
 * the app icon draw rather than a separately maintained raster.
 *
 * The component is server-rendered to SVG markup, the static half of
 * `haus-ghost.css` is inlined into the file, and the drift keyframes and the
 * `--animated` rules are dropped: a favicon has no main thread to spend and
 * every browser rasterizes it once. The mark is then cropped to its own
 * silhouette with a small pad — a favicon is already a 16px tile, so the
 * component's 192x204 viewBox letterboxes it for no reason.
 *
 * Ground. A tab strip is light in one theme and near-black in the other, and
 * the file cannot know which, so the favicon takes the dark-ground scatter:
 * a near-solid white body. That is the pair the mark is built on — on a dark
 * strip the white body is the mark, and on a light strip it disappears into
 * the page and the colored rim and the hairline outline carry it.
 *
 * Sizes are rendered natively rather than downscaled from one large render,
 * because `.haus-ghost__edge` is a `non-scaling-stroke` hairline: rendered at
 * 512 and resampled to 32 it lands at an eighth of a pixel and vanishes,
 * which is the outline the light tab strip depends on.
 *
 *   bun run icon:render-favicon     (from apps/website)
 *   bun run icons:render-favicon    (from the repository root)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HausGhost } from '../src/components/haus-ghost.tsx';

/** The raster sizes the HTML links, each rendered at its own scale. */
export const PNG_TARGETS: readonly { name: string; size: number }[] = [
    { name: 'favicon-32.png', size: 32 },
    { name: 'favicon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
];

export async function renderFavicon({
    outDir = DEFAULT_OUT_DIR,
}: {
    outDir?: string;
} = {}): Promise<readonly string[]> {
    const css = staticGhostCss(await readFile(GHOST_CSS_PATH, 'utf8'));
    const markup = ghostMarkup();
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage({ viewport: { height: 512, width: 512 } });
        const svg = faviconSvg(markup, css, await measureBody(page, markup, css));
        await mkdir(outDir, { recursive: true });

        const written = [path.join(outDir, 'favicon.svg')];
        await writeFile(written[0] as string, svg);

        for (const target of PNG_TARGETS) {
            const file = path.join(outDir, target.name);
            await writeFile(file, await rasterize(page, svg, target.size));
            written.push(file);
        }

        return written;
    } finally {
        await browser.close();
    }
}

/** The component's own markup, with `useId`'s def names pinned to one stable
    instance so a re-render is byte-identical. */
function ghostMarkup(): string {
    const markup = renderToStaticMarkup(createElement(HausGhost, { fill: 'iridescent' }));
    const body = markup.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

    return body.replaceAll(/(haus-ghost-[a-z-]+?)-_R_[^"')]*_/g, '$1-fav');
}

/** The file itself: the component's markup, the theme it needs, and a viewBox
    cropped to the silhouette. */
function faviconSvg(markup: string, css: string, body: Box): string {
    const pad = round(Math.max(body.width, body.height) * PAD_RATIO);
    const side = round(Math.max(body.width, body.height) + 2 * pad);
    const minX = round(body.x + body.width / 2 - side / 2);
    const minY = round(body.y + body.height / 2 - side / 2);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${side} ${side}" width="${side}" height="${side}" class="haus-ghost haus-ghost--iridescent" role="img">
<style>${css}</style>
${markup}
</svg>
`;
}

/** The silhouette's own bounds, so the crop follows the artwork rather than
    the component's layout viewBox. */
async function measureBody(page: Page, markup: string, css: string): Promise<Box> {
    await page.setContent(
        `<svg id="probe" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 204" class="haus-ghost haus-ghost--iridescent"><style>${css}</style>${markup}</svg>`
    );
    const box = await page.evaluate(() => {
        const edge = document.querySelector('.haus-ghost__edge') as unknown as SVGGraphicsElement;
        const { height, width, x, y } = edge.getBBox();

        return { height, width, x, y };
    });

    return { height: round(box.height), width: round(box.width), x: round(box.x), y: round(box.y) };
}

/** One native render per size. `omitBackground` keeps the tile transparent, so
    the ghost sits on whatever the browser paints behind the tab. */
async function rasterize(page: Page, svg: string, size: number): Promise<Buffer> {
    await page.setViewportSize({ height: size, width: size });
    await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>${svg.replace(
            /width="[\d.]+" height="[\d.]+"/,
            `width="${size}" height="${size}"`
        )}`
    );

    return await page.locator('svg').screenshot({ omitBackground: true });
}

/**
 * The static half of `haus-ghost.css`: the custom properties, the stroke
 * weights and the layer opacities, with the drift keyframes, the `--animated`
 * rules, the tempo switch and the ground-dependent theme blocks dropped.
 *
 * Read from the stylesheet rather than restated here, so a change to a stroke
 * weight or a layer opacity reaches the favicon on the next render.
 */
function staticGhostCss(source: string): string {
    const css = source.replaceAll(/\/\*[\s\S]*?\*\//g, '');
    const kept: string[] = [];
    let depth = 0;
    let start = 0;

    for (let index = 0; index < css.length; index += 1) {
        if (css[index] === '{') {
            depth += 1;
            continue;
        }
        if (css[index] !== '}') {
            continue;
        }
        depth -= 1;
        if (depth > 0) {
            continue;
        }
        const rule = css.slice(start, index + 1).trim();
        start = index + 1;
        const selector = rule.slice(0, rule.indexOf('{')).trim();
        if (selector && !SKIPPED_SELECTOR.test(selector)) {
            kept.push(collapse(rule));
        }
    }

    return `\n${kept.join('\n')}\n${collapse(FAVICON_THEME)}\n`;
}

function collapse(rule: string): string {
    return rule.replaceAll(/\s+/g, ' ').replaceAll('; }', ';}');
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

interface Box {
    height: number;
    width: number;
    x: number;
    y: number;
}

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newPage']>>;

/**
 * The favicon's only departure from the component.
 *
 * The scatter is the dark-ground block's, because a transparent tile has no
 * ground to read through the glass and a nearly clear body would leave the
 * mark as colored trim around a hole. The outline is raised from 0.5 because
 * it carries the mark on a light tab strip at a single hairline pixel, where
 * the sidebar row has a near-black ground doing that work instead.
 */
const FAVICON_THEME = `.haus-ghost {
    --haus-ghost-scatter: 0.94;
    --haus-ghost-scatter-mid: 0.98;
    --haus-ghost-scatter-outer: 0.96;
    --haus-ghost-edge: 0.75;
}`;

/** Animation, tempo and ground-dependent rules: none of them apply to a tile
    that is rasterized once, on an unknown ground. */
const SKIPPED_SELECTOR = /^@|--animated|--lively|\[data-theme|\.dark |^html\./;

/** Roughly a twenty-fifth of the mark on every side. */
const PAD_RATIO = 0.04;

const GHOST_CSS_PATH = fileURLToPath(
    new URL('../src/components/haus-ghost.css', import.meta.url)
);
const DEFAULT_OUT_DIR = fileURLToPath(new URL('../public', import.meta.url));

if (import.meta.main) {
    const written = await renderFavicon();
    for (const file of written) {
        console.log(`[haus] favicon rendered to ${file}`);
    }
}
