import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import {
  ResultStatusBadge,
  RunStatusBadge,
  ScorePill,
} from "@/components/common/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { evaluationQuery, evaluationResultsQuery } from "@/hooks/use-ragbench";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EvaluationResult } from "@/types";

export const Route = createFileRoute("/evaluations/$runId")({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(evaluationQuery(params.runId)),
      context.queryClient.ensureQueryData(evaluationResultsQuery(params.runId)),
    ]),
  head: ({ params }) => ({
    meta: [
      { title: `Evaluation Run ${params.runId} — RAGBench` },
      {
        name: "description",
        content: `Query-level results, metrics and failure diagnosis for evaluation run ${params.runId}.`,
      },
      { property: "og:title", content: `Evaluation Run ${params.runId} — RAGBench` },
      { property: "og:description", content: "Query-level RAG evaluation results and failure diagnosis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunDetailsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Evaluations">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load run: {error.message}
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Evaluations">
      <div className="panel p-6 text-sm text-muted-foreground">Evaluation run not found.</div>
    </AppShell>
  ),
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "fail", label: "Failed" },
  { key: "pass", label: "Passed" },
  { key: "hallucination", label: "Hallucination" },
  { key: "retrieval_failure", label: "Retrieval failure" },
  { key: "low_faithfulness", label: "Low faithfulness" },
  { key: "slow", label: "Slow queries" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function matchesFilter(result: EvaluationResult, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "fail":
      return result.status === "fail";
    case "pass":
      return result.status === "pass";
    case "hallucination":
      return result.failureType === "hallucination";
    case "retrieval_failure":
      return result.failureType === "retrieval_failure";
    case "low_faithfulness":
      return result.faithfulness < 0.7;
    case "slow":
      return result.latencyMs > 3_000;
  }
}

function EvalCheck({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          pass ? "text-success" : "text-destructive",
        )}
      >
        {pass ? "Pass" : "Fail"}
      </span>
    </div>
  );
}

function InspectionDrawer({
  result,
  onClose,
}: {
  result: EvaluationResult | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {result && (
          <>
            <SheetHeader>
              <SheetTitle className="text-base">Query Inspection</SheetTitle>
              <SheetDescription>
                Understand exactly why this query {result.status === "pass" ? "passed" : "failed"}.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 px-4 pb-8">
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Question
                </h4>
                <p className="mt-1.5 text-sm font-medium text-foreground">{result.question}</p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected Answer
                  </h4>
                  <p className="mt-1.5 text-sm text-foreground">{result.expectedAnswer}</p>
                </div>
                <div
                  className={cn(
                    "rounded-md border p-3",
                    result.status === "fail"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-muted/40",
                  )}
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Generated Answer
                  </h4>
                  <p className="mt-1.5 text-sm text-foreground">{result.generatedAnswer}</p>
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Retrieved Context
                </h4>
                <div className="mt-2 space-y-2">
                  {result.chunks.map((chunk, index) => (
                    <div key={chunk.id} className="rounded-md border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-foreground">
                          {index + 1}. {chunk.documentName} — Page {chunk.page}
                        </span>
                        <span className="num text-muted-foreground">
                          sim {chunk.similarity.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Evaluation
                </h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <EvalCheck label="Retrieval" pass={result.retrievalScore >= 0.7} />
                  <EvalCheck label="Context Relevance" pass={result.contextRelevance >= 0.7} />
                  <EvalCheck label="Faithfulness" pass={result.faithfulness >= 0.7} />
                  <EvalCheck label="Answer Correctness" pass={result.correctness >= 0.7} />
                </div>
              </section>

              {result.diagnosis && (
                <section className="rounded-md border border-warning/30 bg-warning/5 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-warning">
                    Failure Diagnosis
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                    {result.diagnosis}
                  </p>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RunDetailsPage() {
  const { runId } = Route.useParams();
  const { data: run } = useSuspenseQuery(evaluationQuery(runId));
  const { data: results } = useSuspenseQuery(evaluationResultsQuery(runId));
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<EvaluationResult | null>(null);

  const filtered = useMemo(
    () => results.filter((result) => matchesFilter(result, filter)),
    [results, filter],
  );

  return (
    <AppShell title="Evaluations" breadcrumb={["Evaluations", run.label]}>
      <PageHeader
        title={run.label}
        description={`${run.datasetName} · ${run.questions} questions · ${run.configurationName}`}
        actions={<RunStatusBadge status={run.status} />}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {run.generation.slice(0, 3).map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
        {run.retrieval.slice(2, 3).map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
        {run.performance.slice(0, 2).map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold">Query-level Results</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={filter === option.key ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Question</TableHead>
                <TableHead>Expected Answer</TableHead>
                <TableHead>Generated Answer</TableHead>
                <TableHead className="text-right">Retrieval</TableHead>
                <TableHead className="text-right">Correctness</TableHead>
                <TableHead className="text-right">Faithfulness</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((result) => (
                <TableRow
                  key={result.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(result)}
                >
                  <TableCell className="max-w-0">
                    <span className="line-clamp-2 font-medium text-foreground">
                      {result.question}
                    </span>
                    {result.failureType && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {result.failureType.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-0">
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {result.expectedAnswer}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {result.generatedAnswer}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ScorePill value={result.retrievalScore} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ScorePill value={result.correctness} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ScorePill value={result.faithfulness} />
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {formatMs(result.latencyMs)}
                  </TableCell>
                  <TableCell>
                    <ResultStatusBadge status={result.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No queries match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InspectionDrawer result={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}
