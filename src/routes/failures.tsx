import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Lightbulb, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/page-header";
import {
  axisTick,
  CHART_PALETTE,
  gridStroke,
  tooltipStyle,
} from "@/components/common/chart-theme";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { failuresQuery, recommendationsQuery } from "@/hooks/use-ragbench";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FailureType, Severity } from "@/types";

export const Route = createFileRoute("/failures")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(failuresQuery()),
      context.queryClient.ensureQueryData(recommendationsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Failure Analysis — RAGBench" },
      {
        name: "description",
        content:
          "Diagnose RAG failures: retrieval failures, hallucinations, citation errors and optimization recommendations.",
      },
      { property: "og:title", content: "Failure Analysis — RAGBench" },
      { property: "og:description", content: "Diagnose and categorize RAG pipeline failures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FailuresPage,
  errorComponent: ({ error }) => (
    <AppShell title="Failure Analysis">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load failure analysis: {error.message}
      </div>
    </AppShell>
  ),
});

const severityClasses: Record<Severity, string> = {
  critical: "text-destructive",
  high: "text-destructive/80",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const TYPE_LABELS: Record<FailureType, string> = {
  retrieval_failure: "Retrieval Failure",
  generation_failure: "Generation Failure",
  hallucination: "Hallucination",
  context_irrelevance: "Context Irrelevance",
  citation_error: "Citation Error",
  other: "Other",
};

function FailuresPage() {
  const { data } = useSuspenseQuery(failuresQuery());
  const { data: recommendations } = useSuspenseQuery(recommendationsQuery());
  const [typeFilter, setTypeFilter] = useState<FailureType | "all">("all");

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? data.failures
        : data.failures.filter((failure) => failure.failureType === typeFilter),
    [data.failures, typeFilter],
  );

  const recommendation = recommendations[0];

  return (
    <AppShell title="Failure Analysis">
      <PageHeader
        title="Failure Analysis"
        description="Diagnose where and why your RAG pipeline fails — then turn each pattern into an experiment."
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Failures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="metric-value text-4xl font-semibold text-foreground">{data.total}</div>
            <ul className="mt-4 space-y-2.5">
              {data.breakdown.map((entry, index) => (
                <li key={entry.type}>
                  <button
                    type="button"
                    onClick={() =>
                      setTypeFilter((prev) => (prev === entry.type ? "all" : entry.type))
                    }
                    className={cn(
                      "w-full text-left",
                      typeFilter === entry.type && "rounded-md ring-1 ring-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{entry.label}</span>
                      <span className="num font-medium text-foreground">
                        {Math.round(entry.share * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${entry.share * 100}%`,
                          backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length],
                        }}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Failure Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                <ChartTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                <Area type="monotone" dataKey="retrieval" name="Retrieval" stroke={CHART_PALETTE[0]} fill={CHART_PALETTE[0]} fillOpacity={0.12} />
                <Area type="monotone" dataKey="hallucination" name="Hallucination" stroke={CHART_PALETTE[4]} fill={CHART_PALETTE[4]} fillOpacity={0.12} />
                <Area type="monotone" dataKey="contextIrrelevance" name="Context Irrelevance" stroke={CHART_PALETTE[2]} fill={CHART_PALETTE[2]} fillOpacity={0.12} />
                <Area type="monotone" dataKey="citation" name="Citation" stroke={CHART_PALETTE[3]} fill={CHART_PALETTE[3]} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {recommendation && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-wrap items-start gap-4 p-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Lightbulb className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Optimization Recommendation
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  Bottleneck: {recommendation.bottleneck}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{recommendation.summary}</p>
              <p className="mt-2 text-xs font-medium text-foreground">Suggested experiments:</p>
              <ul className="mt-1.5 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                {recommendation.suggestions.map((suggestion, index) => (
                  <li key={suggestion} className="flex items-center gap-2">
                    <span className="num text-primary">{index + 1}.</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild size="sm">
              <Link to="/experiments">
                <Plus className="size-3.5" /> Create Experiment
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={typeFilter === "all" ? "secondary" : "ghost"}
          className="h-7 px-2.5 text-xs"
          onClick={() => setTypeFilter("all")}
        >
          All
        </Button>
        {(Object.keys(TYPE_LABELS) as FailureType[]).map((type) => (
          <Button
            key={type}
            size="sm"
            variant={typeFilter === type ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs"
            onClick={() => setTypeFilter(type)}
          >
            {TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Question</TableHead>
              <TableHead>Failure Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Experiment</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((failure) => (
              <TableRow key={failure.id}>
                <TableCell className="max-w-0">
                  <span className="line-clamp-1 font-medium text-foreground">
                    {failure.question}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {TYPE_LABELS[failure.failureType]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide",
                      severityClasses[failure.severity],
                    )}
                  >
                    {failure.severity}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{failure.experiment}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(failure.detectedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                    <Link to="/evaluations/$runId" params={{ runId: failure.runId }}>
                      Inspect query
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
