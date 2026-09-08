import { cn } from '../../lib/utils.ts';
import {
    type CloudAgentPresentationStatus,
    type CloudAgentTone,
    cloudAgentStatusTone,
} from './cloud-agent-presentation.ts';

// A literal size, not a spacing step: a status glyph should not shrink because
// the row around it tightened.
const glyphSize = 'size-[15px]';

const toneClasses: Record<CloudAgentTone, string> = {
    accent: 'text-accent',
    danger: 'text-danger',
    muted: 'text-muted',
    success: 'text-success',
};

// Inner pie geometry, shared with the task disc: a half-radius circle with a
// stroke as wide as itself renders as a solid wedge via dasharray.
const pieRadius = 2;
const pieCircumference = 2 * Math.PI * pieRadius;

/**
 * The Cloud Agent work's one point of lifecycle color: a dashed ring while it
 * waits for the provider, a filling ring while it runs, and a solid disc with
 * a check or a cross once it settles.
 */
export function CloudAgentStatusDisc({
    className,
    status,
}: {
    className?: string;
    status: CloudAgentPresentationStatus;
}) {
    const toneClass = toneClasses[cloudAgentStatusTone(status)];

    if (status === 'queued') {
        return (
            <svg
                aria-hidden="true"
                className={cn(glyphSize, 'shrink-0', toneClass, className)}
                viewBox="0 0 16 16"
            >
                <circle
                    cx="8"
                    cy="8"
                    fill="none"
                    r="6"
                    stroke="currentColor"
                    strokeDasharray="2.6 2.6"
                    strokeWidth="1.5"
                />
            </svg>
        );
    }

    if (status === 'running' || status === 'cancelling') {
        return (
            <svg
                aria-hidden="true"
                className={cn(glyphSize, 'shrink-0', toneClass, className)}
                viewBox="0 0 16 16"
            >
                <circle cx="8" cy="8" fill="none" r="6" stroke="currentColor" strokeWidth="1.5" />
                <circle
                    cx="8"
                    cy="8"
                    fill="none"
                    r={pieRadius}
                    stroke="currentColor"
                    strokeDasharray={`${0.5 * pieCircumference} ${pieCircumference}`}
                    strokeWidth={pieRadius * 2}
                    transform="rotate(-90 8 8)"
                />
            </svg>
        );
    }

    return (
        <svg
            aria-hidden="true"
            className={cn(glyphSize, 'shrink-0', toneClass, className)}
            viewBox="0 0 16 16"
        >
            <circle cx="8" cy="8" fill="currentColor" r="6.75" />
            {/* var(--surface), not white: the disc fills with a theme token,
                and a white glyph washes out on it. */}
            {status === 'completed' ? (
                <path
                    d="M5.1 8.3l2 2 3.8-4.2"
                    fill="none"
                    stroke="var(--surface)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                />
            ) : (
                <path
                    d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2"
                    fill="none"
                    stroke="var(--surface)"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                />
            )}
        </svg>
    );
}
