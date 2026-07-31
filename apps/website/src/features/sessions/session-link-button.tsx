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
                'flex min-w-0 flex-col rounded-lg border px-3 py-2 text-left',
                tone === 'amber'
                    ? 'border-[color:var(--warning-border)] bg-[var(--warning-bg)]'
                    : tone === 'sky'
                      ? 'border-[color:var(--info-border)] bg-[var(--info-bg)]'
                      : 'border-border-subtle bg-legacy-muted',
                className
            )}
        >
            {label ? (
                <span
                    className={cn(
                        'font-medium text-caption uppercase tracking-[0.16em]',
                        tone === 'amber'
                            ? 'text-warning'
                            : tone === 'sky'
                              ? 'text-info'
                              : 'text-muted-foreground'
                    )}
                >
                    {label}
                </span>
            ) : null}
            <span className="min-w-0 truncate text-foreground text-sm">{title}</span>
            {subtitle ? (
                <span
                    className={cn(
                        'min-w-0 truncate text-caption',
                        tone === 'amber'
                            ? 'text-warning-foreground'
                            : tone === 'sky'
                              ? 'text-info-foreground'
                              : 'text-muted-foreground'
                    )}
                >
                    {subtitle}
                </span>
            ) : null}
            <span className="min-w-0 truncate font-mono text-caption text-muted-foreground">
                {sessionKey}
            </span>
        </div>
    );
}
