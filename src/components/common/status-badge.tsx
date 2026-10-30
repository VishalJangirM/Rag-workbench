import { cn } from "@/lib/utils";
import type { DocumentStatus, ResultStatus, RunStatus } from "@/types";

type Tone = "success" | "warning" | "destructive" | "info" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  destructive: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/10 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ tone, label, pulse }: { tone: Tone; label: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        toneClasses[tone],
      )}
    >
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}

const documentTone: Record<DocumentStatus, Tone> = {
  indexed: "success",
  uploading: "info",
  processing: "info",
  chunking: "info",
  embedding: "info",
  failed: "destructive",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const busy = status !== "indexed" && status !== "failed";
  return <StatusBadge tone={documentTone[status]} label={status} pulse={busy} />;
}

const resultTone: Record<ResultStatus, Tone> = {
  pass: "success",
  warn: "warning",
  fail: "destructive",
};

export function ResultStatusBadge({ status }: { status: ResultStatus }) {
  return <StatusBadge tone={resultTone[status]} label={status} />;
}

const runTone: Record<RunStatus, Tone> = {
  completed: "success",
  running: "info",
  queued: "neutral",
  failed: "destructive",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <StatusBadge tone={runTone[status]} label={status} pulse={status === "running"} />;
}

export function ScorePill({ value }: { value: number }) {
  const tone: Tone = value >= 0.85 ? "success" : value >= 0.7 ? "warning" : "destructive";
  return (
    <span
      className={cn(
        "num inline-flex rounded border px-1.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {(value * 100).toFixed(0)}%
    </span>
  );
}
