import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { AppShell, ConnectionIndicator } from "@/components/layout/app-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_BASE_URL } from "@/services/api-client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RAGBench" },
      {
        name: "description",
        content:
          "Configure workspace, backend API connection, default models, evaluation metrics and appearance.",
      },
      { property: "og:title", content: "Settings — RAGBench" },
      { property: "og:description", content: "Workspace, API and evaluation defaults for RAGBench." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const DEFAULT_METRICS = [
  "Recall@5",
  "Precision@5",
  "MRR",
  "Answer Correctness",
  "Faithfulness",
  "Hallucination Rate",
  "Citation Correctness",
  "P95 Latency",
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SettingsPage() {
  const [workspace, setWorkspace] = useState("Acme AI Platform");
  const [backendUrl, setBackendUrl] = useState(API_BASE_URL);
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_METRICS.slice(0, 6));
  const [theme, setTheme] = useState("dark");

  const applyTheme = (value: string) => {
    setTheme(value);
    const root = document.documentElement;
    root.classList.toggle("light", value === "light");
    toast.success(`Theme set to ${value}.`);
  };

  return (
    <AppShell title="Settings">
      <PageHeader
        title="Settings"
        description="Workspace, backend connection and evaluation defaults."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Workspace" description="Identifies this workspace across the platform.">
          <div className="space-y-1.5">
            <Label className="text-xs">Workspace name</Label>
            <Input value={workspace} onChange={(event) => setWorkspace(event.target.value)} className="h-9" />
          </div>
          <Button size="sm" onClick={() => toast.success("Workspace updated.")}>
            Save workspace
          </Button>
        </Section>

        <Section title="API" description="The FastAPI backend that serves RAG and evaluation data.">
          <div className="space-y-1.5">
            <Label className="text-xs">Backend URL</Label>
            <Input
              value={backendUrl}
              onChange={(event) => setBackendUrl(event.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">Connection status</span>
            <ConnectionIndicator />
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.info("Pinging backend health endpoint…")}>
            Test connection
          </Button>
        </Section>

        <Section title="Models" description="Defaults applied to new configurations and experiments.">
          <div className="space-y-1.5">
            <Label className="text-xs">Default LLM</Label>
            <Select defaultValue="gpt-4o-mini">
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                <SelectItem value="llama-3.1-70b-instruct">llama-3.1-70b</SelectItem>
                <SelectItem value="claude-3.5-haiku">claude-3.5-haiku</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default embedding model</Label>
            <Select defaultValue="BGE-large-en-v1.5">
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BGE-large-en-v1.5">BGE-large-en-v1.5</SelectItem>
                <SelectItem value="E5-base-v2">E5-base-v2</SelectItem>
                <SelectItem value="MiniLM-L6-v2">MiniLM-L6-v2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Evaluation" description="Metrics computed on every evaluation run.">
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_METRICS.map((metric) => (
              <label key={metric} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={metrics.includes(metric)}
                  onCheckedChange={(checked) =>
                    setMetrics((prev) =>
                      checked ? [...prev, metric] : prev.filter((item) => item !== metric),
                    )
                  }
                />
                {metric}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Appearance" description="RAGBench is dark-first; light mode is available.">
          <div className="space-y-1.5">
            <Label className="text-xs">Theme</Label>
            <Select value={theme} onValueChange={applyTheme}>
              <SelectTrigger className="h-9 w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
