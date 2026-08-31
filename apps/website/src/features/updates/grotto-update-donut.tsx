import type { GrottoUpdateStep } from './grotto-update-model.ts';
import { isCompleteUpdateStep } from './grotto-update-model.ts';

const circleCenter = 10;
const circleRadius = 8;

export function GrottoUpdateDonut({ steps }: { steps: readonly GrottoUpdateStep[] }) {
    const segments = updateDonutSegments(steps);
    const progress =
        segments.length === 0
            ? 0
            : segments.reduce((total, segment) => total + segment.progress, 0) / segments.length;

    return (
        <svg
            aria-label="Updating Grotto"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(progress * 100)}
            className="size-5"
            role="progressbar"
            viewBox="0 0 20 20"
        >
            <circle
                className="fill-none stroke-current opacity-30"
                cx={circleCenter}
                cy={circleCenter}
                r={circleRadius}
                strokeWidth={3}
            />
            <g transform={`rotate(-90 ${circleCenter} ${circleCenter})`}>
                {segments.map((segment) => (
                    <circle
                        className="fill-none stroke-current"
                        cx={circleCenter}
                        cy={circleCenter}
                        key={segment.id}
                        pathLength={1}
                        r={circleRadius}
                        strokeDasharray={`${segment.fill} ${1 - segment.fill}`}
                        strokeDashoffset={-segment.offset}
                        strokeWidth={3}
                    />
                ))}
            </g>
        </svg>
    );
}

export function updateDonutSegments(steps: readonly GrottoUpdateStep[]) {
    return steps.map((step, index) => {
        const share = 1 / steps.length;
        const progress = isCompleteUpdateStep(step) ? 1 : clampProgress(step.progress);
        return {
            fill: progress * share,
            id: step.id,
            offset: index * share,
            progress,
        };
    });
}

function clampProgress(progress: number | null) {
    return progress === null ? 0 : Math.min(1, Math.max(0, progress));
}
