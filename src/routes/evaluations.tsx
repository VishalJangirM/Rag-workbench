import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { RunStatusBadge } from "@/components/common/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  configurationsQuery,
  datasetsQuery,
  evaluationsQuery,
} from "@/hooks/use-ragbench";
import { formatDate, formatDuration } from "@/lib/format";
import { evaluationService } from "@/services/ragbench";

export const Route = createFileRoute("/evaluations")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(evaluationsQuery()),
      context.queryClient.ensureQueryData(datasetsQuery()),
      context.queryClient.ensureQueryData(configurationsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Evaluation Harness — RAGBench" },
      {
        name: "description",
        content:
          "Run automated evaluation suites against your RAG pipeline: retrieval, generation and performance metrics.",
      },
      { property: "og:title", content: "Evaluation Harness — RAGBench" },
      { property: "og:description", content: "Automated RAG evaluation suites and run history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EvaluationsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Evaluations">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load evaluations: {error.message}
      </div>
    </AppShell>
  ),
});

// Statuses that mean "still working". Anything else counts as finished.
const ACTIVE_STATUSES = new Set(["running", "queued", "pending", "preparing", "in_progress"]);

function EvaluationsList() {
  const queryClient = useQueryClient();
  const { data: rawRuns } = useSuspenseQuery(evaluationsQuery());
  const { data: datasets } = useSuspenseQuery(datasetsQuery());
  const { data: configurations } = useSuspenseQuery(configurationsQuery());

  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [configId, setConfigId] = useState(configurations[0]?.id ?? "");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Newest run first, no matter what order the backend returns.
  const runs = useMemo(
    () =>
      [...rawRuns].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [rawRuns],
  );

  const selectedDataset = datasets.find((dataset) => dataset.id === datasetId);
  const questionCount = selectedDataset?.totalQuestions ?? 0;

  const runMutation = useMutation({
    mutationFn: () =>
      evaluationService.run({
        datasetId,
        configurationId: configId,
        questions: questionCount,
      }),
    onSuccess: async (run) => {
      setActiveRunId(run.id);
      await queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not start the evaluation run.");
    },
  });

  // While a run is active, refresh the list every 2 seconds (max about 3 minutes).
  useEffect(() => {
    if (!activeRunId) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      void queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      if (attempts >= 90) {
        clearInterval(timer);
        setActiveRunId(null);
        toast.error("The run is taking too long. Check the backend terminal for errors.");
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [activeRunId, queryClient]);

  // Stop when the active run is no longer running.
  const activeRun = runs.find((run) => run.id === activeRunId);
  useEffect(() => {
    if (!activeRunId || !activeRun) return;
    if (!ACTIVE_STATUSES.has(String(activeRun.status).toLowerCase())) {
      if (String(activeRun.status).toLowerCase() === "failed") {
        toast.error("Evaluation run failed. Check the backend terminal.");
      } else {
        toast.success("Evaluation run completed.");
      }
      setActiveRunId(null);
    }
  }, [activeRun, activeRunId]);

  const isBusy = runMutation.isPending || activeRunId !== null;

  const latest =
    runs.find((run) => String(run.status).toLowerCase() === "completed") ?? runs[0];

  return (
    <AppShell title="Evaluations">
      <PageHeader
        title="Evaluation Harness"
        description="Run automated evaluation suites against your RAG pipeline."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Dataset</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger className="h-9 w-56 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id} className="text-xs">
                    {dataset.name} ({dataset.totalQuestions})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">RAG Configuration</Label>
            <Select value={configId} onValueChange={setConfigId}>
              <SelectTrigger className="h-9 w-64 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {configurations.map((configuration) => (
                  <SelectItem key={configuration.id} value={configuration.id} className="text-xs">
                    {configuration.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Questions</Label>
            <div className="flex h-9 w-32 items-center rounded-md border border-border px-3 text-xs text-muted-foreground">
              {questionCount} (all)
            </div>
          </div>
          <Button
            onClick={() => runMutation.mutate()}
            disabled={isBusy || !datasetId || !configId}
            className="ml-auto"
          >
            <Play className="size-3.5" /> Run Evaluation
          </Button>
        </CardContent>
        {isBusy && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {runMutation.isPending
                  ? "Starting evaluation…"
                  : `Running ${questionCount} questions against the backend…`}
              </span>
            </div>
            <Progress value={runMutation.isPending ? 8 : 60} className="mt-2 h-1.5 animate-pulse" />
          </div>
        )}
      </Card>

      {latest && (
        <>
          <h2 className="text-sm font-semibold text-foreground">
            Latest completed run — {latest.label}
          </h2>
          <div className="space-y-4">
            {(
              [
                ["Retrieval Metrics", latest.retrieval],
                ["Generation Metrics", latest.generation],
                ["Performance Metrics", latest.performance],
              ] as const
            ).map(([title, metrics]) => (
              <Card key={title}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {metrics.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium text-foreground">{run.label}</TableCell>
                  <TableCell className="text-muted-foreground">{run.datasetName}</TableCell>
                  <TableCell className="text-muted-foreground">{run.configurationName}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {run.questions}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(run.startedAt)}</TableCell>
                  <TableCell className="num text-muted-foreground">
                    {formatDuration(run.durationMs)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                      <Link to="/evaluations/$runId" params={{ runId: run.id }}>
                        Details <ChevronRight className="size-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function EvaluationsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // On /evaluations show the list, on /evaluations/<id> show the detail page.
  if (pathname.replace(/\/$/, "") !== "/evaluations") return <Outlet />;
  return <EvaluationsList />;
}