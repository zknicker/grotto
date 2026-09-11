/**
 * The faux-glass stack that fills the iridescent ghost.
 *
 * The mark is a piece of thick, translucent glass, not a painted sticker. What
 * draws the shape is the rim: light entering a thick body piles up where the
 * surface turns away from the viewer, which is why a glass object is hollow in
 * the middle and luminous around its silhouette.
 *
 * How much light the interior scatters depends on the ground, the way it does
 * in the app icon — on a dark tile the body reads pale and luminous, not as a
 * hole cut in the sidebar. On a light page that scatter is a whisper over a
 * body the page has already filled; on a near-black one it *is* the body, so
 * it turns into a near-solid, near-flat white. The CSS owns both the strength
 * and the falloff, in `--haus-ghost-scatter` and its three stops.
 *
 * A soft colored halo sits outside the silhouette, then four layers clipped to
 * the body, painted back to front:
 *
 *   1. the interior scatter, a white radial the theme scales;
 *   2. the drifting color mesh, weighted to the right and bottom and pushed
 *      toward the edge, so the upper left stays nearly clear;
 *   3. a colored inner glow tracing the whole silhouette — the layer that
 *      keeps the mark legible on a light ground, where white cannot;
 *   4. a white inner glow over the upper-left dome only — a soft bloom, a hot
 *      line inside it, and two specular spots: the highlight that sells the
 *      curvature on a dark ground.
 *
 * Every glow is a blurred stroke of the body path clipped back to the body —
 * an inner glow follows the silhouette exactly, where a radial gradient would
 * band on a shape this asymmetric.
 *
 * The outline and the eyes are drawn last and outside the clip, on purpose.
 * The outline is a non-scaling hairline in a gradient that walks the same
 * colors the mesh does — lavender-gray under the highlight into azure, violet
 * and rose down the right and bottom, never ink and never one color — and a
 * stroke clipped to its own path keeps only its inner half, which is a hairline
 * of half the weight sitting inside the silhouette rather than on it. The eyes
 * are opaque marks on top of the glass, not something it tints.
 */

import { type GhostGlassIds, GlassDefs } from './haus-ghost-glass-defs.tsx';
import { GLASS } from './haus-ghost-palette.ts';
import { BODY_PATH, EYES_PATH, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from './haus-ghost-paths.ts';

export function HausGhostGlass({ ids }: { ids: GhostGlassIds }) {
    return (
        <>
            <GlassDefs ids={ids} />
            {/* Outside the clip, under everything: the ground picking up the
                mark's own color, which is what lifts it off both a white page
                and a near-black sidebar. */}
            <path
                className="haus-ghost__halo"
                d={BODY_PATH}
                fill="none"
                filter={`url(#${ids.haloBlur})`}
                stroke={`url(#${ids.rimColor})`}
            />
            <g clipPath={`url(#${ids.clip})`}>
                <rect
                    className="haus-ghost__interior"
                    fill={`url(#${ids.interior})`}
                    height={VIEWBOX_HEIGHT}
                    width={VIEWBOX_WIDTH}
                    x="0"
                    y="0"
                />
                <g mask={`url(#${ids.sideMask})`}>
                    <g mask={`url(#${ids.rimMask})`}>
                        <g filter={`url(#${ids.meshBlur})`}>
                            {MESH_BLOBS.map((blob) => (
                                <circle
                                    className={`haus-ghost__blob haus-ghost__blob--${blob.id}`}
                                    cx={blob.cx}
                                    cy={blob.cy}
                                    fill={blob.color}
                                    fillOpacity={blob.opacity}
                                    key={blob.id}
                                    r={blob.r}
                                />
                            ))}
                        </g>
                    </g>
                    <path
                        className="haus-ghost__rim-color"
                        d={BODY_PATH}
                        fill="none"
                        filter={`url(#${ids.rimBlur})`}
                        stroke={`url(#${ids.rimColor})`}
                    />
                </g>
                <g mask={`url(#${ids.domeMask})`}>
                    <path
                        className="haus-ghost__rim-light"
                        d={BODY_PATH}
                        fill="none"
                        filter={`url(#${ids.lightBlur})`}
                        stroke={GLASS.highlight}
                    />
                    {/* The hot line inside the bloom. A thick edge of glass
                        catches a hard highlight, not a wash — without this the
                        soft glow alone just fogs the interior. */}
                    <path
                        className="haus-ghost__rim-core"
                        d={BODY_PATH}
                        fill="none"
                        filter={`url(#${ids.coreBlur})`}
                        stroke={GLASS.highlight}
                    />
                </g>
                {SPECULARS.map((spot) => (
                    <ellipse
                        className="haus-ghost__specular"
                        cx={spot.cx}
                        cy={spot.cy}
                        fill={GLASS.highlight}
                        // `fill-opacity`, not `opacity`: the CSS rule owns the
                        // layer's strength, and this is the spot's share of it.
                        fillOpacity={spot.weight}
                        filter={`url(#${ids.lightBlur})`}
                        key={spot.cx}
                        rx={spot.rx}
                        ry={spot.ry}
                        transform={`rotate(${spot.angle} ${spot.cx} ${spot.cy})`}
                    />
                ))}
            </g>
            <path
                className="haus-ghost__edge"
                d={BODY_PATH}
                fill="none"
                stroke={`url(#${ids.edge})`}
            />
            <path className="haus-ghost__eyes" d={EYES_PATH} fill={GLASS.eye} />
        </>
    );
}

interface MeshBlob {
    color: string;
    cx: number;
    cy: number;
    id: string;
    opacity: number;
    r: number;
}

/* Azure at the upper right, rose along the lower-right contour, and only a
   soft violet where the two would otherwise mix to gray — the icon's
   arrangement. Each blob is wide enough to cross the silhouette so its color
   wraps the edge rather than stopping short of it, and the rose sits far
   enough out that the body keeps its inner falloff and the edge keeps the
   rest: on the icon the red hugs the lower-right silhouette, it does not pool
   in the middle. Violet is the quietest of the three on purpose; raising it
   is what turned the mark purple. */
const MESH_BLOBS: readonly MeshBlob[] = [
    { id: 'azure', color: GLASS.meshAzure, cx: 154, cy: 68, r: 50, opacity: 0.78 },
    { id: 'violet', color: GLASS.meshViolet, cx: 110, cy: 142, r: 39, opacity: 0.66 },
    { id: 'rose', color: GLASS.meshRose, cx: 163, cy: 187, r: 42, opacity: 0.74 },
];

/** Measured off the icon: a long streak about a third across and a sixth down
    the body, lying along the dome's upper-left arc, with a shorter one trailing
    below it. Two spots, at different angles, are what stop the dome from
    reading as an evenly lit ball. */
const SPECULARS = [
    { cx: 62, cy: 40, rx: 24, ry: 7.5, angle: -40, weight: 1 },
    { cx: 44, cy: 74, rx: 11, ry: 5, angle: -66, weight: 0.6 },
] as const;
