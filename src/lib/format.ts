import type { MetricValue } from "@/types";

export function formatMetric(metric: MetricValue): string {
  switch (metric.format) {
    case "percent":
      return `${(metric.value * 100).toFixed(1)}%`;
    case "seconds":
      return `${metric.value.toFixed(2)}s`;
    case "currency":
      return metric.value >= 0.1
        ? `$${metric.value.toFixed(2)}`
        : `$${metric.value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
    case "number":
      return metric.value.toLocaleString("en-US");
  }
}

export function formatDelta(metric: MetricValue): string {
  const delta = metric.delta ?? 0;
  const sign = delta >= 0 ? "+" : "";
  switch (metric.format) {
    case "percent":
      return `${sign}${(delta * 100).toFixed(1)}%`;
    case "seconds":
      return `${sign}${delta.toFixed(2)}s`;
    case "currency":
      return `${sign}$${delta.toFixed(4)}`;
    case "number":
      return `${sign}${delta.toLocaleString("en-US")}`;
  }
}

/** True when the delta is an improvement given the metric polarity. */
export function isPositiveDelta(metric: MetricValue): boolean {
  const delta = metric.delta ?? 0;
  return metric.polarity === "lower-better" ? delta <= 0 : delta >= 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function scoreTone(
  value: number,
  warnAt = 0.7,
): "success" | "warning" | "destructive" {
  if (value >= 0.85) return "success";
  if (value >= warnAt) return "warning";
  return "destructive";
}
