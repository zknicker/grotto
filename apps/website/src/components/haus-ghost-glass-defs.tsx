/**
 * Every def and every constant the glass stack paints with: the brand palette,
 * the blur radii, the color mesh, and the gradients and masks that decide how
 * much of each layer lands where.
 *
 * The two fade masks are the shape of the whole idea. `sideMask` leans the
 * color right and down; `domeMask` leans the white highlight up and left.
 * Neither ever reaches black, so no layer stops at a line.
 */

import { BODY_PATH, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from './haus-ghost-paths.ts';

export interface GhostGlassIds {
    clip: string;
    coreBlur: string;
    domeMask: string;
    edge: string;
    haloBlur: string;
    interior: string;
    lightBlur: string;
    meshBlur: string;
    rimBlur: string;
    rimColor: string;
    rimMask: string;
    sideMask: string;
}

/** One `useId`-unique name per def, so two marks on a page never collide. */
export function ghostGlassIds(instanceId: string): GhostGlassIds {
    const name = (part: string) => `haus-ghost-${part}-${instanceId}`;

    return {
        clip: name('clip'),
        coreBlur: name('core-blur'),
        domeMask: name('dome'),
        edge: name('edge'),
        haloBlur: name('halo-blur'),
        interior: name('interior'),
        lightBlur: name('light-blur'),
        meshBlur: name('mesh-blur'),
        rimBlur: name('rim-blur'),
        rimColor: name('rim-color'),
        rimMask: name('rim-mask'),
        sideMask: name('side-mask'),
    };
}

export function GlassDefs({ ids }: { ids: GhostGlassIds }) {
    return (
        <defs>
            <clipPath id={ids.clip}>
                <path d={BODY_PATH} />
            </clipPath>
            {BLURS.map((blur) => (
                <filter
                    filterUnits="userSpaceOnUse"
                    height={VIEWBOX_HEIGHT + 2 * FILTER_MARGIN}
                    id={ids[blur.id]}
                    key={blur.id}
                    width={VIEWBOX_WIDTH + 2 * FILTER_MARGIN}
                    x={-FILTER_MARGIN}
                    y={-FILTER_MARGIN}
                >
                    <feGaussianBlur stdDeviation={blur.deviation} />
                </filter>
            ))}
            <radialGradient
                cx="70"
                cy="76"
                gradientUnits="userSpaceOnUse"
                id={ids.interior}
                r="140"
            >
                {SCATTER_PROFILE.map((stop) => (
                    <stop
                        key={stop.offset}
                        offset={stop.offset}
                        stopColor={GLASS.highlight}
                        stopOpacity={stop.opacity}
                    />
                ))}
            </radialGradient>
            <linearGradient
                gradientUnits="userSpaceOnUse"
                id={ids.rimColor}
                x1="158"
                x2="86"
                y1="16"
                y2="200"
            >
                {RIM_COLOR_STOPS.map((stop) => (
                    <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
                ))}
            </linearGradient>
            <linearGradient
                gradientUnits="userSpaceOnUse"
                id={ids.edge}
                x1="26"
                x2="164"
                y1="16"
                y2="192"
            >
                {EDGE_STOPS.map((stop) => (
                    <stop
                        key={stop.offset}
                        offset={stop.offset}
                        stopColor={stop.color}
                        stopOpacity={stop.opacity}
                    />
                ))}
            </linearGradient>
            {/* Color leans right and down. A mask, not a per-layer opacity, so
                the mesh and the colored rim fade together and the upper-left
                quadrant stays clear enough for the white highlight to own it. */}
            <FadeMask id={ids.sideMask} stops={SIDE_FADE} x1={18} x2={150} y1={14} y2={172} />
            {/* The white highlight is the mirror of it: the dome only. */}
            <FadeMask id={ids.domeMask} stops={DOME_FADE} x1={14} x2={150} y1={40} y2={110} />
            {/* Hollow in the middle, luminous at the silhouette — the one
                gradient that makes a translucent shape read as thick glass. */}
            <mask
                height={MASK_SPAN}
                id={ids.rimMask}
                maskUnits="userSpaceOnUse"
                width={MASK_SPAN}
                x={-MASK_MARGIN}
                y={-MASK_MARGIN}
            >
                <rect
                    fill={RIM_MASK_FLOOR}
                    height={MASK_SPAN}
                    width={MASK_SPAN}
                    x={-MASK_MARGIN}
                    y={-MASK_MARGIN}
                />
                <path
                    d={BODY_PATH}
                    fill="none"
                    filter={`url(#${ids.rimBlur})`}
                    stroke="#fff"
                    strokeWidth={RIM_MASK_WIDTH}
                />
            </mask>
        </defs>
    );
}

function FadeMask({
    id,
    stops,
    x1,
    x2,
    y1,
    y2,
}: {
    id: string;
    stops: readonly FadeStop[];
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}) {
    const gradientId = `${id}-fade`;

    return (
        <>
            <linearGradient
                gradientUnits="userSpaceOnUse"
                id={gradientId}
                x1={x1}
                x2={x2}
                y1={y1}
                y2={y2}
            >
                {stops.map((stop) => (
                    <stop key={stop.offset} offset={stop.offset} stopColor={stop.gray} />
                ))}
            </linearGradient>
            <mask
                height={MASK_SPAN}
                id={id}
                maskUnits="userSpaceOnUse"
                width={MASK_SPAN}
                x={-MASK_MARGIN}
                y={-MASK_MARGIN}
            >
                <rect
                    fill={`url(#${gradientId})`}
                    height={MASK_SPAN}
                    width={MASK_SPAN}
                    x={-MASK_MARGIN}
                    y={-MASK_MARGIN}
                />
            </mask>
        </>
    );
}

interface FadeStop {
    gray: string;
    offset: number;
}

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

/** Room for the widest blob plus its blur plus its drift. */
const FILTER_MARGIN = 120;
const MASK_MARGIN = 60;
const MASK_SPAN = VIEWBOX_HEIGHT + 2 * MASK_MARGIN;

const BLURS = [
    /** Roughly half a blob, which is what fuses the three into one gradient. */
    { id: 'meshBlur', deviation: 15 },
    /** The colored rim is a bloom, so it stays the softest of the three. */
    { id: 'rimBlur', deviation: 9 },
    { id: 'lightBlur', deviation: 5 },
    /** Barely softened: the hot line has to stay a line. */
    { id: 'coreBlur', deviation: 2 },
    /** Tight enough that the halo never reads as haze in a 22px row. */
    { id: 'haloBlur', deviation: 2.5 },
] as const satisfies readonly { deviation: number; id: keyof GhostGlassIds }[];

/** The *shape* of the interior scatter, not its strength: a peak under the
    dome falling away toward the silhouette, where the colored rim takes over.
    `--haus-ghost-scatter` scales the whole profile, so a light ground keeps
    a whisper of tint and a dark ground gets the icon's pale luminous body. */
const SCATTER_PROFILE = [
    { offset: 0, opacity: 1 },
    { offset: 0.6, opacity: 0.72 },
    { offset: 1, opacity: 0.3 },
] as const;

/** The stable colored rim under the drifting mesh, so the silhouette stays
    colored wherever the blobs happen to have wandered off to. */
const RIM_COLOR_STOPS = [
    { offset: 0, color: GLASS.azure },
    { offset: 0.42, color: GLASS.violet },
    { offset: 0.78, color: GLASS.rose },
    { offset: 1, color: GLASS.roseLight },
] as const;

/** The outline runs upper-left to lower-right, so it walks the same colors the
    mesh does: cool lavender-gray where the highlight sits, then azure, violet
    and rose down the right and bottom. Never one color, and never ink — the
    edge should read as glass catching light. `--haus-ghost-edge` carries the
    strength, so these are relative weights along the run. */
const EDGE_STOPS = [
    { offset: 0, color: GLASS.edgeCool, opacity: 0.9 },
    { offset: 0.38, color: GLASS.azure, opacity: 1 },
    { offset: 0.68, color: GLASS.violet, opacity: 1 },
    { offset: 1, color: GLASS.rose, opacity: 1 },
] as const;

/** Never reaches black: the upper left keeps a trace of color so the mesh
    fades out rather than stopping at a line. */
const SIDE_FADE: readonly FadeStop[] = [
    { offset: 0, gray: '#262626' },
    { offset: 0.3, gray: '#4d4d4d' },
    { offset: 0.65, gray: '#d0d0d0' },
    { offset: 1, gray: '#fff' },
];

/** Keeps a floor rather than reaching black: the white line still traces the
    far edge, faintly, so the silhouette closes. */
const DOME_FADE: readonly FadeStop[] = [
    { offset: 0, gray: '#fff' },
    { offset: 0.34, gray: '#dedede' },
    { offset: 0.72, gray: '#4a4a4a' },
    { offset: 1, gray: '#363636' },
];

/** Grey floor, not black: the mesh still tints the deep interior, it just
    stops flooding it. */
const RIM_MASK_FLOOR = '#464646';
/** Straddles the path; the body clip throws away the outer half. */
const RIM_MASK_WIDTH = 40;
