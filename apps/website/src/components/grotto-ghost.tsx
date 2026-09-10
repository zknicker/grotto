import { type ComponentPropsWithoutRef, useId } from 'react';
import { cn } from '../lib/utils.ts';
import { GrottoGhostGlass } from './grotto-ghost-glass.tsx';
import { ghostGlassIds } from './grotto-ghost-glass-defs.tsx';
import { BODY_PATH, EYES_PATH, VIEWBOX_HEIGHT, VIEWBOX_WIDTH } from './grotto-ghost-paths.ts';
import './grotto-ghost.css';

type GrottoGhostProps = {
    /**
     * `solid` paints the body in `currentColor` with the eyes punched out as
     * holes, so whatever sits behind the mark shows through them.
     * `iridescent` renders it as translucent glass: a hollow interior the
     * ground reads through, a mesh-colored rim, and a white dome highlight.
     */
    fill?: GhostFill;
    /** Iridescent only: drift the mesh so the color slowly reorganizes. */
    animated?: boolean;
    /** Animated only: `lively` runs the same drift loops 2.5x faster. */
    tempo?: GhostTempo;
    /** Rendered height in px; width follows the 192:204 aspect. */
    size?: number;
    className?: string;
} & Omit<ComponentPropsWithoutRef<'svg'>, 'fill'>;

/** The Grotto ghost as vector artwork, tintable or in full app-icon color. */
export function GrottoGhost({
    fill = 'solid',
    animated = false,
    tempo = 'calm',
    size = 24,
    className,
    style,
    ...props
}: GrottoGhostProps) {
    const instanceId = useId().replaceAll(':', '');
    const iridescent = fill === 'iridescent';
    const drifting = iridescent && animated;
    // A `<title>` is the browser's native tooltip too, and `aria-hidden` does
    // not suppress it — a decorative mark would pop "Grotto" on every hover.
    const decorative = props['aria-hidden'] === true || props['aria-hidden'] === 'true';

    return (
        // biome-ignore lint/a11y/noSvgWithoutTitle: the title is conditional, because a decorative instance names itself with `aria-hidden` instead
        <svg
            className={cn(
                'grotto-ghost',
                iridescent && 'grotto-ghost--iridescent',
                drifting && 'grotto-ghost--animated',
                drifting && tempo === 'lively' && 'grotto-ghost--lively',
                className
            )}
            role={decorative ? undefined : 'img'}
            // Inline, so chrome rules that force a glyph box — the sidebar
            // pins `.sidebar__menu-icon svg` to 1rem — cannot resize the mark.
            style={{ height: size, width: (size * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT, ...style }}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            xmlns="http://www.w3.org/2000/svg"
            {...props}
        >
            {decorative ? null : <title>Grotto</title>}
            {iridescent ? (
                <GrottoGhostGlass ids={ghostGlassIds(instanceId)} />
            ) : (
                <path
                    className="grotto-ghost__body"
                    d={`${BODY_PATH} ${EYES_PATH}`}
                    fill="currentColor"
                    fillRule="evenodd"
                />
            )}
        </svg>
    );
}

type GhostFill = 'solid' | 'iridescent';
type GhostTempo = 'calm' | 'lively';
