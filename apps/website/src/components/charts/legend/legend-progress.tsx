"use client";

import { cn } from "../../../lib/utils.ts";
import { useLegendItem } from "./legend-context";

export interface LegendProgressProps {
  /** Track class name */
  trackClassName?: string;
  /** Indicator class name */
  indicatorClassName?: string;
  /** Track height. Default: "h-1.5" */
  height?: string;
}

export function LegendProgress({
  trackClassName = "",
  indicatorClassName = "",
  height = "h-1.5",
}: LegendProgressProps) {
  const { item } = useLegendItem();

  if (!item.maxValue) {
    return null;
  }

  // Note: item.color must remain inline style as it's dynamic data
  const percent = Math.max(0, Math.min(100, (item.value / item.maxValue) * 100));

  return (
    <div
      aria-valuemax={item.maxValue}
      aria-valuemin={0}
      aria-valuenow={item.value}
      role="progressbar"
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-legend-track",
          height,
          trackClassName
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            indicatorClassName
          )}
          style={{ backgroundColor: item.color, width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

LegendProgress.displayName = "LegendProgress";
