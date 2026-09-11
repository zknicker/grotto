/**
 * A short series drawn at glyph size: a handful of numbers as one small
 * stroke, sized in CSS pixels so a hairline stays a hairline and the shape
 * lines up with the type beside it.
 *
 * The app's other sparkline is `KPI.Chart`, which is Recharts inside a
 * `ResponsiveContainer` — a measured, axis-capable chart that earns its weight
 * in a KPI tile. Inside a 40×14 pill, on a Server that can hold dozens of
 * Agents, that is a resize observer per pill to draw six line segments. At
 * this size the drawing is the primitive, so this is a path, not a chart.
 *
 * Everything is `currentColor`: the series takes the tone of whatever it sits
 * in, which is how one component serves a neutral pill and an accent one.
 */
export function Sparkline({
    className,
    height = 14,
    isLive = false,
    values,
    width = 40,
}: {
    className?: string;
    height?: number;
    /** Marks the newest point as live: a soft halo, stilled by reduced motion. */
    isLive?: boolean;
    values: readonly number[];
    width?: number;
}) {
    if (values.length < 2) {
        return null;
    }

    const points = sparklinePoints(values, width, height);
    const last = points.at(-1) ?? points[0];
    // A series that never left zero has no shape to draw, so it states that
    // plainly: one quiet rule along the floor rather than an invented curve.
    const isFlat = Math.max(...values) <= 0;

    return (
        <svg
            aria-hidden="true"
            className={className}
            focusable="false"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            xmlns="http://www.w3.org/2000/svg"
        >
            {isFlat ? null : (
                <path d={areaPath(points, height)} fill="currentColor" opacity={0.16} />
            )}
            <path
                d={linePath(points)}
                fill="none"
                opacity={isFlat ? 0.3 : 0.85}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.25}
            />
            {isLive ? (
                <circle
                    className="motion-safe:animate-pulse"
                    cx={last.x}
                    cy={last.y}
                    fill="currentColor"
                    opacity={0.4}
                    r={3}
                />
            ) : null}
            {isFlat && !isLive ? null : (
                <circle cx={last.x} cy={last.y} fill="currentColor" r={1.5} />
            )}
        </svg>
    );
}

interface SparklinePoint {
    x: number;
    y: number;
}

/**
 * The series mapped into the box, inset by the stroke's own half-width so the
 * first and last points are not clipped by the viewBox edge.
 */
function sparklinePoints(
    values: readonly number[],
    width: number,
    height: number
): SparklinePoint[] {
    const inset = 1.5;
    const peak = Math.max(...values);
    const step = (width - inset * 2) / (values.length - 1);
    const floor = height - inset;
    const span = floor - inset;

    return values.map((value, index) => ({
        x: inset + index * step,
        y: peak > 0 ? floor - (Math.max(value, 0) / peak) * span : floor,
    }));
}

function linePath(points: readonly SparklinePoint[]): string {
    return points
        .map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
        )
        .join(' ');
}

/** The line closed down to the floor, which reads as volume rather than trend. */
function areaPath(points: readonly SparklinePoint[], height: number): string {
    const first = points[0];
    const last = points.at(-1) ?? first;
    if (!(first && last)) {
        return '';
    }
    return `${linePath(points)} L${last.x.toFixed(2)} ${height} L${first.x.toFixed(2)} ${height} Z`;
}
