import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FileText, Loader2, Save, Send, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { configurationsQuery } from "@/hooks/use-ragbench";
import { formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ragService } from "@/services/ragbench";
import type { ChatMessage, RAGConfiguration, RetrievedChunk } from "@/types";

export const Route = createFileRoute("/playground")({
  loader: ({ context }) => context.queryClient.ensureQueryData(configurationsQuery()),
  head: () => ({
    meta: [
      { title: "RAG Playground — RAGBench" },
      {
        name: "description",
        content:
          "Test RAG configurations interactively: ask questions, inspect retrieved chunks, similarity scores and citations.",
      },
      { property: "og:title", content: "RAG Playground — RAGBench" },
      { property: "og:description", content: "Interactive RAG testing with retrieved-context inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaygroundPage,
  errorComponent: ({ error }) => (
    <AppShell title="RAG Playground">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load playground: {error.message}
      </div>
    </AppShell>
  ),
});

function ChunkCard({ chunk, index }: { chunk: RetrievedChunk; index: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="num font-semibold text-muted-foreground">{index + 1}.</span>
          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground">{chunk.documentName}</span>
          <span className="text-muted-foreground">Page {chunk.page}</span>
        </div>
        <Badge variant="outline" className="num shrink-0 text-[10px]">
          sim {chunk.similarity.toFixed(2)}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
        {chunk.text}
      </p>
      <div className="mt-2 font-mono text-[10px] text-muted-foreground/60">
        chunk {chunk.chunkId}
      </div>
    </div>
  );
}

function ConfigPanel({
  config,
  onChange,
}: {
  config: RAGConfiguration;
  onChange: (config: RAGConfiguration) => void;
}) {
  const saveMutation = useMutation({
    mutationFn: () => ragService.saveConfiguration(config),
    onSuccess: () => toast.success(`Configuration "${config.name}" saved.`),
    onError: () => toast.error("Could not save configuration."),
  });

  const update = <K extends keyof RAGConfiguration>(key: K, value: RAGConfiguration[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <Card className="sticky top-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Embedding Model</Label>
          <Select value={config.embeddingModel} onValueChange={(v) => update("embeddingModel", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BGE-large-en-v1.5">BGE</SelectItem>
              <SelectItem value="E5-base-v2">E5</SelectItem>
              <SelectItem value="MiniLM-L6-v2">MiniLM</SelectItem>
              <SelectItem value="custom-embedding">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Retrieval Strategy</Label>
          <Select
            value={config.retrievalStrategy}
            onValueChange={(v) => update("retrievalStrategy", v as RAGConfiguration["retrievalStrategy"])}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vector">Vector Search</SelectItem>
              <SelectItem value="bm25">BM25</SelectItem>
              <SelectItem value="hybrid">Hybrid Search</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Top K</Label>
            <span className="num text-xs font-medium text-foreground">{config.topK}</span>
          </div>
          <Slider
            value={[config.topK]}
            min={1}
            max={20}
            step={1}
            onValueChange={([value]) => update("topK", value ?? config.topK)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Chunk Size</Label>
            <Select
              value={String(config.chunkSize)}
              onValueChange={(v) => update("chunkSize", Number(v) as RAGConfiguration["chunkSize"])}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[250, 500, 750, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chunk Overlap</Label>
            <Input
              type="number"
              min={0}
              max={config.chunkSize - 1}
              value={config.chunkOverlap}
              onChange={(event) => update("chunkOverlap", Number(event.target.value))}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Reranker</Label>
          <Select
            value={config.reranker}
            onValueChange={(v) => update("reranker", v as RAGConfiguration["reranker"])}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="cross-encoder">Cross Encoder</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">LLM</Label>
          <Select value={config.llm} onValueChange={(v) => update("llm", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
              <SelectItem value="llama-3.1-70b-instruct">llama-3.1-70b</SelectItem>
              <SelectItem value="claude-3.5-haiku">claude-3.5-haiku</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Temperature</Label>
            <span className="num text-xs font-medium text-foreground">
              {config.temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[config.temperature]}
            min={0}
            max={1}
            step={0.1}
            onValueChange={([value]) => update("temperature", value ?? config.temperature)}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="size-3.5" /> Save Configuration
          </Button>
          <Button size="sm" asChild>
            <a href="/evaluations">
              <Zap className="size-3.5" /> Run Evaluation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaygroundPage() {
  const { data: configurations } = useSuspenseQuery(configurationsQuery());
  const [config, setConfig] = useState<RAGConfiguration>(configurations[0]!);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sourceChunk, setSourceChunk] = useState<RetrievedChunk | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryMutation = useMutation({
    mutationFn: (question: string) => ragService.query({ question, configuration: config }),
    onSuccess: (answer, question) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.pending
            ? { id: answer.id, role: "assistant" as const, content: answer.answer, answer }
            : message,
        ),
      );
      void question;
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    },
    onError: () => {
      setMessages((prev) => prev.filter((message) => !message.pending));
      toast.error("Query failed. Check the backend connection.");
    },
  });

  const submit = () => {
    const question = input.trim();
    if (!question || queryMutation.isPending) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `user-${prev.length}`, role: "user", content: question },
      { id: `pending-${prev.length}`, role: "assistant", content: "", pending: true },
    ]);
    queryMutation.mutate(question);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  return (
    <AppShell title="RAG Playground">
      <PageHeader
        title="RAG Playground"
        description="Ask questions against the knowledge base and inspect exactly why the pipeline answered the way it did."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="panel flex min-h-[560px] flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs text-muted-foreground">
              Active configuration:{" "}
              <span className="font-medium text-foreground">{config.name}</span>
            </span>
            <Badge variant="outline" className="text-[10px]">
              {config.retrievalStrategy} · top-{config.topK} · {config.llm}
            </Badge>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-foreground">Test your RAG pipeline</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Try: “What is the employee notice period?” — then expand Retrieved Context to see
                  the chunks, similarity scores and citations behind the answer.
                </p>
              </div>
            )}
            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">
                    {message.content}
                  </div>
                </div>
              ) : message.pending ? (
                <div key={message.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Retrieving context and generating answer…
                </div>
              ) : (
                <div key={message.id} className="max-w-[90%] space-y-3">
                  <div className="rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
                    {message.answer && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                        <span>
                          Confidence{" "}
                          <span className="num font-medium text-success">
                            {(message.answer.confidence * 100).toFixed(0)}%
                          </span>
                        </span>
                        <span>
                          Faithfulness{" "}
                          <span className="num font-medium text-success">
                            {(message.answer.faithfulness * 100).toFixed(0)}%
                          </span>
                        </span>
                        <span className="num">{formatMs(message.answer.latencyMs)}</span>
                        <span className="num">
                          {message.answer.tokens.prompt + message.answer.tokens.completion} tokens
                        </span>
                        <span className="num">${message.answer.costUsd.toFixed(4)}</span>
                      </div>
                    )}
                  </div>

                  {message.answer && (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Sources:</span>
                        {message.answer.chunks.map((chunk) => (
                          <button
                            key={chunk.id}
                            type="button"
                            onClick={() => setSourceChunk(chunk)}
                            className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                          >
                            {chunk.documentName} — Page {chunk.page}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(message.id)) next.delete(message.id);
                            else next.add(message.id);
                            return next;
                          })
                        }
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                      >
                        {expanded.has(message.id) ? (
                          <ChevronUp className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                        Retrieved Context ({message.answer.chunks.length} chunks)
                      </button>
                      {expanded.has(message.id) && (
                        <div className="space-y-2">
                          {message.answer.chunks.map((chunk, index) => (
                            <ChunkCard key={chunk.id} chunk={chunk} index={index} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask a question about your documents…"
                rows={1}
                className="min-h-10 resize-none"
              />
              <Button
                size="icon"
                onClick={submit}
                disabled={!input.trim() || queryMutation.isPending}
                aria-label="Send question"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <ConfigPanel config={config} onChange={setConfig} />
      </div>

      <Sheet open={sourceChunk !== null} onOpenChange={(open) => !open && setSourceChunk(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {sourceChunk && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{sourceChunk.documentName}</SheetTitle>
                <SheetDescription>
                  Page {sourceChunk.page} · chunk {sourceChunk.chunkId} · similarity{" "}
                  {sourceChunk.similarity.toFixed(2)}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <div className="rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                  {sourceChunk.text}
                </div>
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <p>
                    This chunk was retrieved by the{" "}
                    <span className="text-foreground">{config.retrievalStrategy}</span> retriever
                    and scored by{" "}
                    <span className="text-foreground">{config.embeddingModel}</span>.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
