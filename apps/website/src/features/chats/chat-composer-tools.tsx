import { Plus } from '@hugeicons/core-free-icons';
import { Icon } from '../../components/ui/icon.tsx';
import { PromptInputButton } from '../../components/ui/prompt-input.tsx';
import type { ChatContextFullness } from './chat-context-fullness.ts';

export function ChatComposerAttachmentButton({
    disabled,
    onClick,
}: {
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <PromptInputButton
            aria-label="Attach file"
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            tooltip={disabled ? 'Attachments are not available right now.' : 'Attach file'}
            type="button"
            variant="ghost"
        >
            <Icon icon={Plus} />
        </PromptInputButton>
    );
}

export function ChatComposerContextFullness({ fullness }: { fullness: ChatContextFullness }) {
    const radius = 7;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - fullness.percent);
    const percentLabel = `${Math.round(fullness.percent * 100)}%`;

    return (
        <div
            className="flex items-center gap-2 text-muted-foreground text-sm"
            title={`${percentLabel} context used`}
        >
            <svg aria-hidden="true" className="size-5 -rotate-90" viewBox="0 0 20 20">
                <circle
                    className="stroke-muted"
                    cx="10"
                    cy="10"
                    fill="none"
                    r={radius}
                    strokeWidth="3"
                />
                <circle
                    className="stroke-muted-foreground"
                    cx="10"
                    cy="10"
                    fill="none"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    strokeWidth="3"
                />
            </svg>
            <span className="font-medium text-foreground text-sm tabular-nums">{percentLabel}</span>
        </div>
    );
}
