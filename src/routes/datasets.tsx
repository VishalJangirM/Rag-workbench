import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileUp, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { datasetsQuery } from "@/hooks/use-ragbench";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { datasetAdminService } from "@/services/datasets-extra";
import type { Difficulty } from "@/types";

export const Route = createFileRoute("/datasets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(datasetsQuery()),
  head: () => ({
    meta: [
      { title: "Evaluation Datasets — RAGBench" },
      {
        name: "description",
        content:
          "Manage evaluation datasets: questions, expected answers, evidence, difficulty and categories.",
      },
      { property: "og:title", content: "Evaluation Datasets — RAGBench" },
      { property: "og:description", content: "Golden QA datasets for RAG evaluation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatasetsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Datasets">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load datasets: {error.message}
      </div>
    </AppShell>
  ),
});

const difficultyClass: Record<Difficulty, string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-destructive",
};

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// One question per line:  question | expected answer | source | difficulty | category
function parseQuestionLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question = "", expectedAnswer = "", source = "", difficulty = "", category = ""] =
        line.split("|").map((part) => part.trim());
      return { question, expectedAnswer, source, difficulty, category };
    })
    .filter((row) => row.question && row.expectedAnswer);
}

function DatasetsPage() {
  const queryClient = useQueryClient();
  const { data: datasets } = useSuspenseQuery(datasetsQuery());
  const [activeId, setActiveId] = useState(datasets[0]?.id ?? "");
  const active = datasets.find((dataset) => dataset.id === activeId) ?? datasets[0];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questionText, setQuestionText] = useState("");

  const parsedQuestions = parseQuestionLines(questionText);

  const createMutation = useMutation({
    mutationFn: () =>
      datasetAdminService.create({ name, description, questions: parsedQuestions }),
    onSuccess: async (dataset) => {
      toast.success(`Created ${dataset.name} with ${dataset.totalQuestions} questions.`);
      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setActiveId(dataset.id);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setQuestionText("");
    },
    onError: (err: Error) => toast.error(err.message || "Could not create the dataset."),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => datasetAdminService.importFile(file),
    onSuccess: async (dataset) => {
      toast.success(`Imported ${dataset.name} with ${dataset.totalQuestions} questions.`);
      await queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setActiveId(dataset.id);
    },
    onError: (err: Error) => toast.error(err.message || "Import failed."),
  });

  const exportActive = () => {
    if (!active) return;
    const jsonl = active.questions.map((question) => JSON.stringify(question)).join("\n");
    const safeName = active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadTextFile(`${safeName}.jsonl`, jsonl, "application/x-ndjson");
    toast.success(`Exported ${active.questions.length} questions from ${active.name}.`);
  };

  return (
    <AppShell title="Datasets">
      <PageHeader
        title="Evaluation Datasets"
        description="Golden question/answer sets used by the evaluation harness."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={importMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="size-3.5" /> {importMutation.isPending ? "Importing…" : "Import"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportActive} disabled={!active}>
              <Download className="size-3.5" /> Export
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> Create Dataset
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.jsonl,.json,.ndjson"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importMutation.mutate(file);
          event.target.value = "";
        }}
      />

      {!active ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No evaluation datasets found.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {datasets.map((dataset) => (
              <button
                key={dataset.id}
                type="button"
                onClick={() => setActiveId(dataset.id)}
                className={cn(
                  "panel p-4 text-left transition-colors hover:border-border-strong",
                  dataset.id === activeId && "border-primary/50 bg-primary/[0.04]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{dataset.name}</span>
                  <Badge variant="outline" className="num text-[10px]">
                    {dataset.totalQuestions}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                  {dataset.description}
                </p>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Updated {formatDate(dataset.updatedAt)}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["Total Questions", active.totalQuestions],
                ["Easy", active.breakdown.easy],
                ["Medium", active.breakdown.medium],
                ["Hard", active.breakdown.hard],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="panel p-4">
                <div className="text-xs font-medium text-muted-foreground">{label}</div>
                <div className="metric-value mt-2 text-2xl font-semibold text-foreground">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {active.name} — sample questions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[26%]">Question</TableHead>
                    <TableHead className="w-[26%]">Expected Answer</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.questions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-0">
                        <span className="line-clamp-2 font-medium text-foreground">
                          {question.question}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {question.expectedAnswer}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {question.source}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {question.evidence}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium uppercase tracking-wide",
                            difficultyClass[
                              String(question.difficulty).toLowerCase() as Difficulty
                            ],
                          )}
                        >
                          {question.difficulty}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{question.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create dataset</SheetTitle>
            <SheetDescription>
              Add question and answer pairs written against your uploaded documents.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <input
                className={fieldClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My policy questions"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <input
                className={fieldClass}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What these questions cover"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Questions (one per line)</Label>
              <textarea
                className={cn(fieldClass, "min-h-56 font-mono text-xs")}
                value={questionText}
                onChange={(event) => setQuestionText(event.target.value)}
                placeholder={
                  "question | expected answer | source file | difficulty | category\n" +
                  "What is the notice period? | 30 days written notice | hr_policy.pdf | easy | HR Policy"
                }
              />
              <p className="text-xs text-muted-foreground">
                Only the question and expected answer are required. Use the exact uploaded file name
                as the source so retrieval metrics can match it. {parsedQuestions.length} valid
                question{parsedQuestions.length === 1 ? "" : "s"} found.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={
                createMutation.isPending || !name.trim() || parsedQuestions.length === 0
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Create dataset"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}