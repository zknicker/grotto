import { cn } from '../../lib/utils.ts';

export function SessionLinkButton({
    className,
    label,
    sessionKey,
    subtitle,
    title,
    tone = 'neutral',
}: {
    className?: string;
    label?: string;
    sessionKey: string;
    subtitle?: string | null;
    title: string;
    tone?: 'amber' | 'neutral' | 'sky';
}) {
    return (
        <div
            className={cn(
                'card-shell flex min-w-0 flex-col border px-3 py-2 text-left',
                tone === 'amber'
                    ? 'border-warning-soft bg-warning-soft'
                    : tone === 'sky'
                      ? 'border-accent-soft bg-accent-soft'
                      : 'border-separator bg-default',
                className
            )}
        >
            {label ? (
                <span
                    className={cn(
                        'font-medium text-xs uppercase tracking-[0.16em]',
                        tone === 'amber'
                            ? 'text-warning'
                            : tone === 'sky'
                              ? 'text-accent'
                              : 'text-muted'
                    )}
                >
                    {label}
                </span>
            ) : null}
            <span className="min-w-0 truncate text-foreground text-sm">{title}</span>
            {subtitle ? (
                <span
                    className={cn(
                        'min-w-0 truncate text-sm',
                        tone === 'amber'
                            ? 'text-warning'
                            : tone === 'sky'
                              ? 'text-accent-soft-foreground'
                              : 'text-muted'
                    )}
                >
                    {subtitle}
                </span>
            ) : null}
            <span className="min-w-0 truncate font-mono text-muted text-xs">{sessionKey}</span>
        </div>
    );
}
