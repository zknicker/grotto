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
                        <p className="truncate text-base text-foreground">{stat.label}</p>
                    </div>
                    <div className="flex items-center gap-4 text-base">
                        <p className="min-w-[4.5rem] text-right text-foreground tabular-nums">
                            ${stat.total.toFixed(2)}
                        </p>
                        <p className="min-w-[2.5rem] text-right text-muted text-sm tabular-nums">
                            {stat.percent.toFixed(0)}%
                        </p>
                    </div>
                </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
                <p className="font-medium text-base text-foreground">Total</p>
                <div className="flex items-center gap-4 text-base">
                    <p className="min-w-[4.5rem] text-right font-medium text-foreground tabular-nums">
                        ${grandTotal.toFixed(2)}
                    </p>
                    <p className="min-w-[2.5rem] text-right text-muted text-sm tabular-nums">
                        100%
                    </p>
                </div>
            </div>
        </div>
    );
}
