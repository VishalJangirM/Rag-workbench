import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { experimentsQuery } from "@/hooks/use-ragbench";
import { cn } from "@/lib/utils";

const searchSchema = (search: Record<string, unknown>) => ({
  ids: typeof search["ids"] === "string" ? (search["ids"] as string) : "",
});

export const Route = createFileRoute("/experiments/compare")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(experimentsQuery()),
  head: () => ({
    meta: [
      { title: "Compare Experiments — RAGBench" },
      {
        name: "description",
        content: "Side-by-side metric comparison of RAG pipeline experiments.",
      },
      { property: "og:title", content: "Compare Experiments — RAGBench" },
      { property: "og:description", content: "Side-by-side RAG experiment metric comparison." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
  errorComponent: ({ error }) => (
    <AppShell title="Experiments">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load comparison: {error.message}
      </div>
    </AppShell>
  ),
});

interface MetricRow {
  label: string;
  get: (e: { accuracy: number; faithfulness: number; recall: number; overallScore: number; latencySeconds: number; costUsd: number }) => number;
  format: (v: number) => string;
  higherBetter: boolean;
}

const ROWS: MetricRow[] = [
  { label: "Overall Score", get: (e) => e.overallScore, format: (v) => `${v.toFixed(1)}%`, higherBetter: true },
  { label: "Recall@5", get: (e) => e.recall, format: (v) => `${v.toFixed(1)}%`, higherBetter: true },
  { label: "Accuracy", get: (e) => e.accuracy, format: (v) => `${v.toFixed(1)}%`, higherBetter: true },
  { label: "Faithfulness", get: (e) => e.faithfulness, format: (v) => `${v.toFixed(1)}%`, higherBetter: true },
  { label: "Latency", get: (e) => e.latencySeconds, format: (v) => `${v.toFixed(1)}s`, higherBetter: false },
  { label: "Cost / Query", get: (e) => e.costUsd, format: (v) => `$${v.toFixed(4)}`, higherBetter: false },
];

function ComparePage() {
  const { ids } = Route.useSearch();
  const { data: allExperiments } = useSuspenseQuery(experimentsQuery());
  const wanted = ids ? ids.split(",") : [];
  const experiments = allExperiments.filter(
    (e) => wanted.length === 0 || wanted.includes(e.id),
  );

  const bestIndexFor = (row: MetricRow) => {
    let best = 0;
    experiments.forEach((experiment, index) => {
      const better = row.higherBetter
        ? row.get(experiment) > row.get(experiments[best]!)
        : row.get(experiment) < row.get(experiments[best]!);
      if (better) best = index;
    });
    return best;
  };

  const chartData = [
    { metric: "Accuracy", ...Object.fromEntries(experiments.map((e) => [e.id, e.accuracy])) },
    { metric: "Faithfulness", ...Object.fromEntries(experiments.map((e) => [e.id, e.faithfulness])) },
    { metric: "Recall", ...Object.fromEntries(experiments.map((e) => [e.id, e.recall])) },
  ];

  return (
    <AppShell title="Experiments" breadcrumb={["Experiments", "Compare"]}>
      <PageHeader
        title="Experiment Comparison"
        description={`Comparing ${experiments.map((e) => e.id).join(" vs ")} across quality, performance and cost.`}
      />

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              {experiments.map((experiment) => (
                <TableHead key={experiment.id} className="text-right">
                  {experiment.id}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((row) => {
              const best = bestIndexFor(row);
              return (
                <TableRow key={row.label}>
                  <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                  {experiments.map((experiment, index) => (
                    <TableCell
                      key={experiment.id}
                      className={cn(
                        "num text-right",
                        index === best
                          ? "font-semibold text-success"
                          : "text-muted-foreground",
                      )}
                    >
                      {row.format(row.get(experiment))}
                      {index === best && (
                        <span className="ml-1.5 rounded border border-success/25 bg-success/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-success">
                          best
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell className="font-medium text-foreground">Configuration</TableCell>
              {experiments.map((experiment) => (
                <TableCell key={experiment.id} className="text-right text-xs text-muted-foreground">
                  {experiment.retrieval} + {experiment.reranker}
                  <br />
                  {experiment.embedding}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Quality Metrics</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="metric" tick={axisTick} tickLine={false} axisLine={false} />
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
              {experiments.map((experiment, index) => (
                <Bar
                  key={experiment.id}
                  dataKey={experiment.id}
                  fill={CHART_PALETTE[index % CHART_PALETTE.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AppShell>
  );
}
