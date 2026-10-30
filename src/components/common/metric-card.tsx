import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { formatDelta, formatMetric, isPositiveDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricValue } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MetricCard({ metric, className }: { metric: MetricValue; className?: string }) {
  const good = isPositiveDelta(metric);
  const delta = metric.delta;
  return (
    <div className={cn("panel p-4", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`About ${metric.label}`}
              className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              <Info className="size-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 text-xs">
            {metric.tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="metric-value mt-2 text-2xl font-semibold text-foreground">
        {formatMetric(metric)}
      </div>
      {delta !== undefined && (
        <div className="mt-1.5 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "num inline-flex items-center gap-0.5 font-medium",
              good ? "text-success" : "text-destructive",
            )}
          >
            {good ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatDelta(metric)}
          </span>
          <span className="text-muted-foreground/70">vs previous run</span>
        </div>
      )}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="panel animate-pulse p-4">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-3 h-7 w-16 rounded bg-muted" />
      <div className="mt-2 h-3 w-20 rounded bg-muted" />
    </div>
  );
}
