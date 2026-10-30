import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { GitCompareArrows, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { RunStatusBadge } from "@/components/common/status-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { experimentService } from "@/services/ragbench";

export const Route = createFileRoute("/experiments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(experimentsQuery()),
  head: () => ({
    meta: [
      { title: "Experiments — RAGBench" },
      {
        name: "description",
        content:
          "Track and compare RAG experiments across models, embeddings, retrieval strategies and rerankers.",
      },
      { property: "og:title", content: "Experiments — RAGBench" },
      { property: "og:description", content: "Track and compare RAG pipeline experiments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExperimentsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Experiments">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load experiments: {error.message}
      </div>
    </AppShell>
  ),
});

function ExperimentsPage() {
  const queryClient = useQueryClient();
  const { data: experiments } = useSuspenseQuery(experimentsQuery());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const createMutation = useMutation({
    mutationFn: () => experimentService.create({ name: "Untitled experiment" }),
    onSuccess: async (experiment) => {
      toast.success(`Experiment ${experiment.id} queued with the active configuration.`);
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not create experiment."),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AppShell title="Experiments">
      <PageHeader
        title="Experiments"
        description="Track pipeline variants and identify the configuration that performs best."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size < 2}
              asChild={selected.size >= 2}
            >
              {selected.size >= 2 ? (
                <Link
                  to="/experiments/compare"
                  search={{ ids: Array.from(selected).join(",") }}
                >
                  <GitCompareArrows className="size-3.5" /> Compare ({selected.size})
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <GitCompareArrows className="size-3.5" /> Compare
                </span>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              <Plus className="size-3.5" /> New Experiment
            </Button>
          </>
        }
      />

      {experiments.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No experiments yet. Click New Experiment to create one.
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Experiment</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Embedding</TableHead>
                <TableHead>Retrieval</TableHead>
                <TableHead>Reranker</TableHead>
                <TableHead className="text-right">Accuracy</TableHead>
                <TableHead className="text-right">Faithfulness</TableHead>
                <TableHead className="text-right">Recall</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((experiment) => (
                <TableRow
                  key={experiment.id}
                  className={cn(experiment.isBest && "bg-primary/[0.04]")}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(experiment.id)}
                      onCheckedChange={() => toggle(experiment.id)}
                      aria-label={`Select ${experiment.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium text-foreground">{experiment.id}</div>
                        <div className="text-xs text-muted-foreground">{experiment.name}</div>
                      </div>
                      {experiment.isBest && (
                        <Badge className="border-primary/30 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">
                          BEST
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{experiment.model}</TableCell>
                  <TableCell className="text-muted-foreground">{experiment.embedding}</TableCell>
                  <TableCell className="text-muted-foreground">{experiment.retrieval}</TableCell>
                  <TableCell className="text-muted-foreground">{experiment.reranker}</TableCell>
                  <TableCell className="num text-right font-medium text-foreground">
                    {(experiment.accuracy ?? 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {(experiment.faithfulness ?? 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {(experiment.recall ?? 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {(experiment.latencySeconds ?? 0).toFixed(1)}s
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    ${(experiment.costUsd ?? 0).toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={experiment.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}