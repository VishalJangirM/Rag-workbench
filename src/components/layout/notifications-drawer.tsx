import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileWarning, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { documentsQuery, evaluationsQuery } from "@/hooks/use-ragbench";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const READ_KEY = "ragbench.notifications.read";

export interface NotificationItem {
  id: string;
  kind: "success" | "error" | "warning";
  title: string;
  description: string;
  time: string;
  target: { type: "run"; runId: string } | { type: "documents" };
}

function loadRead(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveRead(ids: string[]) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-500)));
  } catch {
    /* storage unavailable: read state is just not remembered */
  }
}

export function useNotifications() {
  const runs = useQuery(evaluationsQuery());
  const docs = useQuery(documentsQuery());
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(loadRead());
  }, []);

  const items = useMemo<NotificationItem[]>(() => {
    const out: NotificationItem[] = [];
    for (const run of runs.data ?? []) {
      const status = String(run.status).toLowerCase();
      if (["running", "queued", "pending", "preparing", "in_progress"].includes(status)) continue;
      const failed = status === "failed";
      out.push({
        id: `run-${run.id}`,
        kind: failed ? "error" : "success",
        title: failed ? "Evaluation run failed" : "Evaluation run completed",
        description: `${run.label} · ${run.datasetName} · ${run.questions} questions`,
        time: run.startedAt,
        target: { type: "run", runId: run.id },
      });
    }
    for (const doc of docs.data ?? []) {
      if (String(doc.status).toLowerCase() !== "failed") continue;
      out.push({
        id: `doc-${doc.id}`,
        kind: "warning",
        title: "Document indexing failed",
        description: doc.errorMessage ? `${doc.name} · ${doc.errorMessage}` : doc.name,
        time: doc.updatedAt,
        target: { type: "documents" },
      });
    }
    return out
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 25);
  }, [runs.data, docs.data]);

  const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveRead(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = Array.from(new Set([...prev, ...items.map((item) => item.id)]));
      saveRead(next);
      return next;
    });
  }, [items]);

  return { items, readIds, unreadCount, markRead, markAllRead };
}

const ICONS = {
  success: { Icon: CheckCircle2, className: "text-success" },
  error: { Icon: XCircle, className: "text-destructive" },
  warning: { Icon: FileWarning, className: "text-warning" },
} as const;

export function NotificationsDrawer({
  open,
  onOpenChange,
  notifications,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: ReturnType<typeof useNotifications>;
}) {
  const navigate = useNavigate();
  const { items, readIds, unreadCount, markRead, markAllRead } = notifications;

  const openItem = (item: NotificationItem) => {
    markRead(item.id);
    onOpenChange(false);
    if (item.target.type === "run") {
      navigate({ to: "/evaluations/$runId", params: { runId: item.target.runId } });
    } else {
      navigate({ to: "/documents" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[92vw] flex-col gap-0 overflow-y-auto border-l border-border bg-surface p-0 sm:max-w-none lg:w-[390px]"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
          <SheetDescription className="text-xs">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-end border-b border-border px-5 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            Mark all as read
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="size-5" />
            No notifications yet. Run an evaluation or upload a document.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const { Icon, className } = ICONS[item.kind];
              const unread = !readIds.includes(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50",
                      unread && "bg-primary/[0.04]",
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", className)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {unread && <span className="size-1.5 rounded-full bg-primary" />}
                      </div>
                      <div className="mt-0.5 break-words text-xs text-muted-foreground">
                        {item.description}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatDate(item.time)}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}