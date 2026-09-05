import type { AskStatus } from '@grotto/api';
import { BubbleChatQuestionIcon } from '@hugeicons-pro/core-stroke-rounded';
import { EntityAvatar } from '../../components/ui/entity-avatar.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { cn } from '../../lib/utils.ts';
import { askMarkerLabel, askStatusText } from './ask-presentation.ts';

export interface MessageAskProfile {
    avatarUrl: null | string;
    name: string;
}

/**
 * One Ask as it reads on its Message: the Ask glyph, the addressee whose
 * decision it waits on, and a trailing status. Task-chip grammar — annotation
 * scale, neutral throughout, with only the status disc carrying lifecycle
 * color.
 */
export function MessageAskMarker({
    addresseeProfile,
    answeredByName,
    status,
}: {
    addresseeProfile: MessageAskProfile | null;
    answeredByName: null | string;
    status: AskStatus;
}) {
    const statusText = askStatusText({ answeredByName, status });

    return (
        <span
            // Annotation scale, matching the author line — without an explicit
            // size it inherits the message container and outgrows the body text.
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-muted text-sm"
            data-testid="message-ask-marker"
        >
            <Icon className="size-3.5 shrink-0" icon={BubbleChatQuestionIcon} />
            <span className="shrink-0">{askMarkerLabel}</span>
            {addresseeProfile ? (
                <span className="flex min-w-0 items-center gap-1.5">
                    <EntityAvatar
                        name={addresseeProfile.name}
                        size={14}
                        src={addresseeProfile.avatarUrl}
                    />
                    <span className="truncate">{addresseeProfile.name}</span>
                </span>
            ) : null}
            <AskStatusDisc status={status} />
            {status === 'answered' ? (
                <span className="truncate">{statusText}</span>
            ) : (
                <span className="sr-only">{statusText}</span>
            )}
        </span>
    );
}

/**
 * The Ask's one point of lifecycle color: an accent ring while the question is
 * open, a filled success disc with a check once somebody answered.
 */
function AskStatusDisc({ status }: { status: AskStatus }) {
    return (
        <svg
            aria-hidden="true"
            // A literal size, not a spacing step: a status glyph should not
            // shrink because the row around it tightened.
            className={cn(
                'size-[15px] shrink-0',
                status === 'open' ? 'text-accent' : 'text-success'
            )}
            viewBox="0 0 16 16"
        >
            {status === 'open' ? (
                <circle cx="8" cy="8" fill="none" r="6" stroke="currentColor" strokeWidth="1.5" />
            ) : (
                <>
                    <circle cx="8" cy="8" fill="currentColor" r="6.75" />
                    {/* var(--surface), not white: the disc fills with a theme
                        token, and a white glyph washes out on it. */}
                    <path
                        d="M5.1 8.3l2 2 3.8-4.2"
                        fill="none"
                        stroke="var(--surface)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                    />
                </>
            )}
        </svg>
    );
}
