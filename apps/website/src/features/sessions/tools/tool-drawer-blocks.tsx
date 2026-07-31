import type { ReactNode } from 'react';
import { CopyButton } from '../../../components/copy-button.tsx';
import { cn } from '../../../lib/utils.ts';

export function ToolDrawerSectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="mb-2 font-medium text-caption text-muted uppercase tracking-[0.14em]">
            {children}
        </p>
    );
}

/** Mono text block with a hover copy affordance; scrolls when text is long. */
export function ToolDrawerMonoBlock({
    className,
    copyLabel,
    text,
}: {
    className?: string;
    copyLabel: string;
    text: string;
}) {
    return (
        <div className="group/mono-block relative rounded-lg border border-separator bg-surface-secondary">
            <pre
                className={cn(
                    'overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-foreground text-sm leading-relaxed',
                    className
                )}
            >
                {text}
            </pre>
            <CopyButton
                className="absolute top-1.5 right-1.5 bg-surface/80 opacity-0 transition-opacity group-focus-within/mono-block:opacity-100 group-hover/mono-block:opacity-100"
                label={copyLabel}
                value={text}
            />
        </div>
    );
}
