import { cn } from '../../lib/utils.ts';

interface ColorPresetBadgeProps {
    color: string;
    disabled?: boolean;
    isSelected: boolean;
    label: string;
    onClick: () => void;
}

export function ColorPresetBadge({
    color,
    disabled = false,
    isSelected,
    label,
    onClick,
}: ColorPresetBadgeProps) {
    return (
        <button
            aria-pressed={isSelected}
            className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 font-medium text-meta transition-colors disabled:cursor-not-allowed disabled:opacity-64',
                isSelected
                    ? 'border-border-strong bg-secondary text-secondary-foreground ring-1 ring-ring/20'
                    : 'border-border-strong bg-card text-muted-foreground hover:bg-hover'
            )}
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            {label}
        </button>
    );
}
