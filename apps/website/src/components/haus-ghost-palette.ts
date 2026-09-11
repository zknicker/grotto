/**
 * Every color the glass stack paints with, and the stop tables that place
 * those colors along a run: the interior scatter's falloff, the colored rim,
 * the outline, and the two fade masks.
 *
 * The fade tables are the shape of the whole idea. `SIDE_FADE` leans the color
 * right and down; `DOME_FADE` leans the white highlight up and left. Neither
 * ever reaches black, so no layer stops at a line.
 */

/* Brand palette for the mark, read off the app icon. Not theme tokens: the
   ghost keeps its own colors on every ground. */
export const GLASS = {
    /** Every white in the stack — scatter, rim light, specular. */
    highlight: '#fff',
    /** The upper-left outline. The mesh has no color up there, so the edge
        samples the highlight's own cool cast instead of falling back to ink. */
    edgeCool: '#8d92c5',
    azure: '#00baff',
    violet: '#a551ff',
    rose: '#ff43a6',
    roseLight: '#ff78bd',
    /** The three drifting blobs: deeper than the rim, since they are what the
        rim and the halo are sampling. */
    meshAzure: '#00adff',
    meshViolet: '#9539ff',
    meshRose: '#ff43a6',
    eye: '#1f1d24',
} as const;

export interface FadeStop {
    gray: string;
    offset: number;
}

/** Only the run the interior scatter falls off along, dome to silhouette. Its
    shape belongs to the ground as much as its strength does — a whisper over a
    body the page filled, or the body itself — so the CSS owns every stop. */
export const SCATTER_PROFILE = [
    { offset: 0, falloff: '--haus-ghost-scatter-peak' },
    { offset: 0.6, falloff: '--haus-ghost-scatter-mid' },
    { offset: 1, falloff: '--haus-ghost-scatter-outer' },
] as const;

/** The stable colored rim under the drifting mesh, so the silhouette stays
    colored wherever the blobs wandered off to — and with the blobs now
    travelling two-fifths of the mark, that job matters more than it did. It
    runs upper-right to lower-left, so its later half *is* the lower-right
    contour: rose owns that whole stretch — right lobe through the bottom — and
    only softens to `roseLight` by the bottom-left lobe, while violet is a short
    transition rather than a region of its own.

    Stable on purpose. Breathing these stops was measured and rejected: a
    one-notch swing along the ramp moved the 22px mark by 0.9 of 255 per channel
    over three seconds and cost 8.4% of a core, because changing a stop
    invalidates the paint server and re-rasterizes every filter and mask in the
    mark. The drifting blobs buy 5.9 for 0.95%. */
export const RIM_COLOR_STOPS = [
    { offset: 0, color: GLASS.azure },
    { offset: 0.32, color: GLASS.violet },
    { offset: 0.58, color: GLASS.rose },
    { offset: 0.86, color: GLASS.rose },
    { offset: 1, color: GLASS.roseLight },
] as const;

/** The outline runs upper-left to lower-right, so it walks the same colors the
    mesh does: cool lavender-gray where the highlight sits, then azure, violet
    and rose down the right and bottom. Never one color, and never ink — the
    edge should read as glass catching light. `--haus-ghost-edge` carries the
    strength, so these are relative weights along the run. */
export const EDGE_STOPS = [
    { offset: 0, color: GLASS.edgeCool, opacity: 0.9 },
    { offset: 0.38, color: GLASS.azure, opacity: 1 },
    { offset: 0.68, color: GLASS.violet, opacity: 1 },
    { offset: 1, color: GLASS.rose, opacity: 1 },
] as const;

/** Never reaches black: the upper left keeps a trace of color so the mesh
    fades out rather than stopping at a line. */
export const SIDE_FADE: readonly FadeStop[] = [
    { offset: 0, gray: '#262626' },
    { offset: 0.3, gray: '#4d4d4d' },
    { offset: 0.65, gray: '#d0d0d0' },
    { offset: 1, gray: '#fff' },
];

/** Keeps a floor rather than reaching black: the white line still traces the
    far edge, faintly, so the silhouette closes. */
export const DOME_FADE: readonly FadeStop[] = [
    { offset: 0, gray: '#fff' },
    { offset: 0.34, gray: '#dedede' },
    { offset: 0.72, gray: '#4a4a4a' },
    { offset: 1, gray: '#363636' },
];

/** Grey floor, not black: the mesh still tints the deep interior, it just
    stops flooding it. Lowering the floor moves color *outward* without dimming
    it — the mesh follows the contour instead of pooling in the middle. */
export const RIM_MASK_FLOOR = '#3e3e3e';
