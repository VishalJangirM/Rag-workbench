import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { modelsQuery } from "@/hooks/use-ragbench";
import type { ModelEntry, ModelKind } from "@/types";

export const Route = createFileRoute("/models")({
  loader: ({ context }) => context.queryClient.ensureQueryData(modelsQuery()),
  head: () => ({
    meta: [
      { title: "Model Registry — RAGBench" },
      {
        name: "description",
        content:
          "Registry of LLMs, embedding models and rerankers with latency, cost and benchmark scores.",
      },
      { property: "og:title", content: "Model Registry — RAGBench" },
      { property: "og:description", content: "LLM, embedding and reranker registry for RAG pipelines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Models">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load models: {error.message}
      </div>
    </AppShell>
  ),
});

const KINDS: { key: ModelKind; label: string }[] = [
  { key: "llm", label: "LLM" },
  { key: "embedding", label: "Embedding" },
  { key: "reranker", label: "Reranker" },
];

// Backends often return "LLM" / "EMBEDDING" in upper case; compare case-insensitively.
const kindOf = (model: ModelEntry) => String(model.kind ?? "").toLowerCase();

function ModelTable({ models }: { models: ModelEntry[] }) {
  if (models.length === 0) {
    return (
      <div className="panel p-8 text-center text-sm text-muted-foreground">
        No models in this category.
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Context</TableHead>
            <TableHead className="text-right">Avg Latency</TableHead>
            <TableHead className="text-right">Cost / 1K tokens</TableHead>
            <TableHead className="text-right">Benchmark</TableHead>
            <TableHead className="text-right">Enabled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => (
            <TableRow key={model.id}>
              <TableCell className="font-mono text-xs font-medium text-foreground">
                {model.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{model.provider}</TableCell>
              <TableCell className="uppercase text-muted-foreground">{model.kind}</TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {(model.contextWindow ?? 0).toLocaleString()}
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                {(model.avgLatencySeconds ?? 0).toFixed(2)}s
              </TableCell>
              <TableCell className="num text-right text-muted-foreground">
                ${(model.costPer1kTokensUsd ?? 0).toFixed(5)}
              </TableCell>
              <TableCell className="num text-right font-medium text-foreground">
                {(model.benchmarkScore ?? 0).toFixed(1)}
              </TableCell>
              <TableCell className="text-right">
                <Switch
                  defaultChecked={model.enabled}
                  aria-label={`Toggle ${model.name}`}
                  onCheckedChange={(checked) =>
                    toast.success(`${model.name} ${checked ? "enabled" : "disabled"}.`)
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ModelsPage() {
  const { data: models } = useSuspenseQuery(modelsQuery());

  return (
    <AppShell title="Models">
      <PageHeader
        title="Model Registry"
        description="Every model available to your RAG pipelines, with cost and quality characteristics."
        actions={
          <Button
            size="sm"
            onClick={() => toast.info("Model configuration form coming from the backend registry.")}
          >
            <Plus className="size-3.5" /> Add Model
          </Button>
        }
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
          {KINDS.map((kind) => (
            <TabsTrigger key={kind.key} value={kind.key} className="text-xs">
              {kind.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <ModelTable models={models} />
        </TabsContent>
        {KINDS.map((kind) => (
          <TabsContent key={kind.key} value={kind.key} className="mt-4">
            <ModelTable models={models.filter((model) => kindOf(model) === kind.key)} />
          </TabsContent>
        ))}
      </Tabs>

      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((kind) => {
          const subset = models.filter((model) => kindOf(model) === kind.key);
          const best = subset.reduce<ModelEntry | undefined>(
            (acc, model) =>
              !acc || (model.benchmarkScore ?? 0) > (acc.benchmarkScore ?? 0) ? model : acc,
            undefined,
          );
          return (
            <Card key={kind.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Best {kind.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {best ? (
                  <>
                    <div className="font-mono text-sm font-medium text-foreground">{best.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {best.provider} · benchmark {(best.benchmarkScore ?? 0).toFixed(1)} ·{" "}
                      {(best.avgLatencySeconds ?? 0).toFixed(2)}s
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">No {kind.label} models yet.</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}