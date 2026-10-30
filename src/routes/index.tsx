import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Lightbulb, Plus } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import {
  axisTick,
  CHART_PALETTE,
  gridStroke,
  tooltipStyle,
} from "@/components/common/chart-theme";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardQuery } from "@/hooks/use-ragbench";
import type { Experiment } from "@/types";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery()),
  head: () => ({
    meta: [
      { title: "Overview — RAGBench" },
      {
        name: "description",
        content:
          "Monitor retrieval quality, generation quality, latency, cost and experiment results for your RAG pipelines.",
      },
      { property: "og:title", content: "RAGBench — RAG Evaluation Overview" },
      {
        property: "og:description",
        content: "Evaluate. Benchmark. Optimize. Analytics for production RAG systems.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
  errorComponent: ({ error }) => (
    <AppShell title="Overview">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load dashboard: {error.message}
      </div>
    </AppShell>
  ),
});

const COMPARISON_METRICS = [
  { key: "overallScore", label: "Overall Score" },
  { key: "accuracy", label: "Accuracy" },
  { key: "faithfulness", label: "Faithfulness" },
  { key: "recall", label: "Retrieval Recall" },
  { key: "latencySeconds", label: "Latency" },
  { key: "costUsd", label: "Cost" },
] as const;

type ComparisonKey = (typeof COMPARISON_METRICS)[number]["key"];

function ComparisonChart({ experiments }: { experiments: Experiment[] }) {
  const [metric, setMetric] = useState<ComparisonKey>("overallScore");
  const isPercent = metric !== "latencySeconds" && metric !== "costUsd";
  const data = experiments.map((experiment) => ({
    name: experiment.id,
    value: experiment[metric],
  }));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Experiment Comparison</CardTitle>
        <Select value={metric} onValueChange={(value) => setMetric(value as ComparisonKey)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARISON_METRICS.map((option) => (
              <SelectItem key={option.key} value={option.key} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                isPercent ? `${value}%` : metric === "costUsd" ? `$${value}` : `${value}s`
              }
            />
            <ChartTooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                isPercent
                  ? `${Number(value).toFixed(1)}%`
                  : metric === "costUsd"
                    ? `$${Number(value).toFixed(4)}`
                    : `${Number(value).toFixed(2)}s`,
                COMPARISON_METRICS.find((option) => option.key === metric)?.label ?? "",
              ]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={index === 2 ? CHART_PALETTE[0] : "var(--color-muted)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function OverviewPage() {
  const { data } = useSuspenseQuery(dashboardQuery());
  return (
    <AppShell title="Overview">
      <PageHeader
        title="RAG Evaluation Overview"
        description="Monitor retrieval quality, generation quality, performance, and experiment results."
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground lg:flex">
              <span className="font-medium text-foreground">{data.activeConfiguration.name}</span>
              <span className="text-border-strong">·</span>
              <span>{data.activeDataset.name}</span>
            </div>
            <Button asChild size="sm">
              <Link to="/evaluations">Run Evaluation</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {data.kpis.map((metric) => (
          <MetricCard key={metric.key} metric={metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Evaluation Score Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.scoreTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="run" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[70, 100]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <ChartTooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                <Line type="monotone" dataKey="overall" name="Overall" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="retrieval" name="Retrieval" stroke={CHART_PALETTE[1]} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="generation" name="Generation" stroke={CHART_PALETTE[3]} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="faithfulness" name="Faithfulness" stroke={CHART_PALETTE[2]} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <ComparisonChart experiments={data.experimentComparison} />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Accuracy vs Latency</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="latency"
                  name="Latency"
                  unit="s"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, "dataMax + 0.5"]}
                />
                <YAxis
                  type="number"
                  dataKey="accuracy"
                  name="Accuracy"
                  unit="%"
                  domain={[75, 100]}
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis type="number" dataKey="cost" range={[80, 400]} name="Cost" />
                <ChartTooltip
                  contentStyle={tooltipStyle}
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value, name) => {
                    if (name === "Latency") return [`${Number(value).toFixed(2)}s`, name];
                    if (name === "Accuracy") return [`${Number(value).toFixed(1)}%`, name];
                    return [`$${Number(value).toFixed(4)}`, name];
                  }}
                />
                <Scatter data={data.accuracyVsLatency} name="Experiments">
                  {data.accuracyVsLatency.map((point, index) => (
                    <Cell key={point.experiment} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Failure Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex h-64 items-center">
            <ResponsiveContainer width="55%" height="100%">
              <PieChart>
                <Pie
                  data={data.failureBreakdown}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {data.failureBreakdown.map((entry, index) => (
                    <Cell key={entry.type} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <ChartTooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-2">
              {data.failureBreakdown.map((entry, index) => (
                <li key={entry.type} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: CHART_PALETTE[index % CHART_PALETTE.length] }}
                  />
                  <span className="flex-1 text-muted-foreground">{entry.label}</span>
                  <span className="num font-medium text-foreground">
                    {Math.round(entry.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

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
              <span className="rounded border border-warning/25 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
                High impact
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{data.recommendation.summary}</p>
            <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              {data.recommendation.suggestions.map((suggestion, index) => (
                <li key={suggestion} className="flex items-center gap-2">
                  <span className="num text-primary">{index + 1}.</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild size="sm">
              <Link to="/experiments">
                <Plus className="size-3.5" /> Create Experiment
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/failures">
                Inspect failures <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
