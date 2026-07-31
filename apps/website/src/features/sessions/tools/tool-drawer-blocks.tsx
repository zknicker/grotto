import type { ReactNode } from 'react';
import { CopyButton } from '../../../components/ui/copy-button.tsx';
import { cn } from '../../../lib/utils.ts';

export function ToolDrawerSectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="mb-2 font-medium text-caption text-muted-foreground uppercase tracking-[0.14em]">
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
        <div className="group/mono-block relative rounded-lg border border-border-subtle bg-legacy-muted">
            <pre
                className={cn(
                    'overflow-auto whitespace-pre-wrap break-words px-3.5 py-3 font-mono text-foreground text-sm leading-relaxed',
                    className
                )}
            >
                {text}
            </pre>
            <CopyButton
                className="absolute top-1.5 right-1.5 bg-background/80 opacity-0 transition-opacity group-focus-within/mono-block:opacity-100 group-hover/mono-block:opacity-100"
                label={copyLabel}
                value={text}
            />
        </div>
    );
}
