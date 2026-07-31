import type { UsageKeyStat } from './use-usage-spend.ts';

interface UsageSpendSummaryProps {
    grandTotal: number;
    stats: UsageKeyStat[];
}

export function UsageSpendSummary({ grandTotal, stats }: UsageSpendSummaryProps) {
    if (stats.length === 0) {
        return null;
    }

    return (
        <div className="mt-2">
            {stats.map((stat) => (
                <div
                    className="flex items-center justify-between border-separator border-b py-2.5"
                    key={stat.id}
                >
                    <div className="flex min-w-0 items-center gap-2">
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: stat.color }}
                        />
                        <span className="truncate text-foreground text-sm">{stat.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="min-w-[4.5rem] text-right text-foreground tabular-nums">
                            ${stat.total.toFixed(2)}
                        </span>
                        <span className="min-w-[2.5rem] text-right text-muted tabular-nums">
                            {stat.percent.toFixed(0)}%
                        </span>
                    </div>
                </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
                <span className="font-medium text-foreground text-sm">Total</span>
                <div className="flex items-center gap-4 text-sm">
                    <span className="min-w-[4.5rem] text-right font-medium text-foreground tabular-nums">
                        ${grandTotal.toFixed(2)}
                    </span>
                    <span className="min-w-[2.5rem] text-right text-muted tabular-nums">100%</span>
                </div>
            </div>
        </div>
    );
}
