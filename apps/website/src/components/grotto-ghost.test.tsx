import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GrottoGhost } from './grotto-ghost.tsx';

const iridescent = () => renderToStaticMarkup(<GrottoGhost fill="iridescent" />);
const ghostCss = await Bun.file(new URL('./grotto-ghost.css', import.meta.url)).text();

describe('Grotto ghost', () => {
    test('punches the eyes out of a single tintable path when solid', () => {
        const markup = renderToStaticMarkup(<GrottoGhost />);

        expect(markup.match(/<path/g)).toHaveLength(1);
        expect(markup).toContain('fill-rule="evenodd"');
        expect(markup).toContain('fill="currentColor"');
        expect(markup).not.toContain('<circle');
    });

    test('clips every glass layer to the body and blurs them in user space', () => {
        const markup = iridescent();
        const clipId = markup.match(/<clipPath[^>]*\sid="([^"]+)"/)?.[1];

        expect(clipId).toBeTruthy();
        expect(markup).toContain(`clip-path="url(#${clipId})"`);
        // A bbox filter region would crop the blur off the drifting blobs.
        expect(markup.match(/filterUnits="userSpaceOnUse"/g)).toHaveLength(5);
        expect(markup).toContain('class="grotto-ghost__eyes"');
    });

    test('draws the silhouette with a colored rim, not with a fill', () => {
        const markup = iridescent();
        const rimId = markup.match(/<linearGradient[^>]*\sid="([^"]*rim-color[^"]*)"/)?.[1];

        expect(rimId).toBeTruthy();
        expect(markup).toContain(`stroke="url(#${rimId})"`);
        expect(markup).toContain('#00baff');
        expect(markup).toContain('#ff43a6');
        // The rim is a stroke of the body path clipped back to it, so the mark
        // has no filled body at all beyond the interior tint.
        expect(markup).toContain('class="grotto-ghost__rim-color"');
        expect(markup).not.toContain('class="grotto-ghost__body"');
    });

    test('lets the theme decide how much light the interior scatters', () => {
        const markup = iridescent();
        const tint = markup.match(/<radialGradient[^>]*>(.*?)<\/radialGradient>/s)?.[1] ?? '';
        const stops = [...tint.matchAll(/stop-opacity="([\d.]+)"/g)].map((m) => Number(m[1]));

        // The gradient is only the falloff *shape*; the strength is the CSS
        // variable, so a light ground stays nearly clear and a dark one gets
        // the icon's pale luminous body instead of a smoky hole.
        expect(stops[0]).toBe(1);
        expect(stops).toEqual([...stops].sort((a, b) => b - a));
        expect(stops.at(-1)).toBeLessThan(0.5);
        expect(markup).toContain('class="grotto-ghost__interior"');
        expect(ghostCss).toContain('fill-opacity: var(--grotto-ghost-scatter)');
        expect(ghostCss).toContain('opacity: var(--grotto-ghost-specular)');
    });

    test("scales the ground-dependent layers on the app's own dark selector", () => {
        const dark = ghostCss.slice(ghostCss.indexOf("[data-theme='dark'] .grotto-ghost"));

        expect(dark).toContain('.dark .grotto-ghost');
        for (const variable of ['scatter', 'specular', 'edge', 'halo']) {
            expect(dark).toContain(`--grotto-ghost-${variable}:`);
        }
        // A dark ground has to scatter far more light than a light one, or the
        // ghost reads as a dark blob with faint colored edges.
        const scatter = (css: string) =>
            Number(css.match(/--grotto-ghost-scatter:\s*([\d.]+)/)?.[1]);

        expect(scatter(dark)).toBeGreaterThan(4 * scatter(ghostCss));
    });

    test('outlines the mark in a gradient that samples the mesh, never in ink', () => {
        const markup = iridescent();
        const edgeId = markup.match(/<linearGradient[^>]*\sid="([^"]*-edge-[^"]*)"/)?.[1];
        const edge = markup.match(/<linearGradient[^>]*-edge-[^>]*>(.*?)<\/linearGradient>/s)?.[1];

        expect(edgeId).toBeTruthy();
        expect(markup).toContain(`class="grotto-ghost__edge" d=`);
        expect(markup).toContain(`stroke="url(#${edgeId})"`);
        // Cool lavender-gray under the highlight, then the mesh colors down the
        // right and bottom: an outline catching light, not a hairline of ink.
        expect(edge).toContain('#8d92c5');
        expect(edge).toContain('#00baff');
        expect(edge).toContain('#ff43a6');
        expect(markup).not.toContain('#1a1630');
        expect(ghostCss).toContain('stroke-opacity: var(--grotto-ghost-edge)');
    });

    test('lifts the mark off the ground with a colored halo outside the clip', () => {
        const markup = iridescent();
        const rimId = markup.match(/<linearGradient[^>]*\sid="([^"]*rim-color[^"]*)"/)?.[1];
        const clipIndex = markup.indexOf('<g clip-path=');
        const haloIndex = markup.indexOf('class="grotto-ghost__halo"');

        expect(haloIndex).toBeGreaterThan(-1);
        // Outside the body clip and beneath every other layer, or it would be
        // an inner glow rather than the ground picking up the mark's color.
        expect(haloIndex).toBeLessThan(clipIndex);
        expect(markup).toContain(`class="grotto-ghost__halo" d=`);
        expect(markup.slice(haloIndex)).toContain(`stroke="url(#${rimId})"`);
        expect(ghostCss).toContain('opacity: var(--grotto-ghost-halo)');
    });

    test('lights the upper-left dome in white and leaves the color to the right', () => {
        const markup = iridescent();
        const domeId = markup.match(/<mask[^>]*\sid="([^"]*dome[^"]*)"/)?.[1];

        expect(domeId).toBeTruthy();
        expect(markup).toContain(`mask="url(#${domeId})"`);
        expect(markup).toContain('class="grotto-ghost__rim-light"');
        expect(markup).toContain('class="grotto-ghost__rim-core"');
        expect(markup.match(/class="grotto-ghost__specular"/g)).toHaveLength(2);
    });

    test('drifts three blobs, weighted away from the upper left', () => {
        const markup = iridescent();
        const sideId = markup.match(/<mask[^>]*\sid="([^"]*side-mask[^"]*)"/)?.[1];

        expect(markup.match(/<circle/g)).toHaveLength(3);
        for (const color of ['#00adff', '#9539ff', '#ff43a6']) {
            expect(markup).toContain(color);
        }
        expect(sideId).toBeTruthy();
        expect(markup).toContain(`mask="url(#${sideId})"`);
    });

    test('scopes every def to the instance, so two marks never collide', () => {
        const pair = renderToStaticMarkup(
            <>
                <GrottoGhost fill="iridescent" />
                <GrottoGhost fill="iridescent" />
            </>
        );
        const ids = [...pair.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('names the mark for assistive tech, but never when it is decorative', () => {
        const labelled = renderToStaticMarkup(<GrottoGhost />);
        const decorative = renderToStaticMarkup(<GrottoGhost aria-hidden="true" />);

        expect(labelled).toContain('<title>Grotto</title>');
        expect(labelled).toContain('role="img"');
        // `aria-hidden` hides the mark from assistive tech but not from the
        // browser's own `<title>` tooltip, so the title has to go with it.
        expect(decorative).not.toContain('<title>');
        expect(decorative).not.toContain('role="img"');
    });

    test('sizes by height and keeps the 192:204 aspect', () => {
        const markup = renderToStaticMarkup(<GrottoGhost size={102} />);

        expect(markup).toContain('height:102px');
        expect(markup).toContain('width:96px');
    });

    test('drifts the mesh only for the animated iridescent fill', () => {
        expect(renderToStaticMarkup(<GrottoGhost animated fill="iridescent" />)).toContain(
            'grotto-ghost--animated'
        );
        expect(iridescent()).not.toContain('grotto-ghost--animated');
        expect(renderToStaticMarkup(<GrottoGhost animated />)).not.toContain(
            'grotto-ghost--animated'
        );
    });

    test('steps the drift, and stops it when the window is not being looked at', () => {
        // The blobs drift inside a Gaussian blur nested in two masks and a
        // clip, so every distinct transform re-runs that filter chain on the
        // main thread. A continuous drift cost 10% of a core on every route;
        // stepping it is what makes the mark affordable, and pausing it while
        // the window is blurred is what makes it free.
        const drift = ghostCss.slice(
            ghostCss.indexOf('.grotto-ghost--animated .grotto-ghost__blob')
        );

        expect(drift).toMatch(/animation-timing-function:\s*steps\(\d+,\s*end\)/);
        expect(drift).not.toContain('ease-in-out');
        expect(ghostCss).toContain(
            'html.window-blurred .grotto-ghost--animated .grotto-ghost__blob'
        );
        expect(ghostCss.slice(ghostCss.indexOf('html.window-blurred'))).toContain(
            'animation-play-state: paused'
        );
    });

    test('quickens the drift only when a lively tempo is asked for', () => {
        expect(
            renderToStaticMarkup(<GrottoGhost animated fill="iridescent" tempo="lively" />)
        ).toContain('grotto-ghost--lively');
        expect(renderToStaticMarkup(<GrottoGhost animated fill="iridescent" />)).not.toContain(
            'grotto-ghost--lively'
        );
    });
});
