import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CloudUpload, Eye, FileText, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { DocumentStatusBadge } from "@/components/common/status-badge";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
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
import { documentsQuery } from "@/hooks/use-ragbench";
import { formatBytes, formatDate, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { documentService } from "@/services/ragbench";
import type { KnowledgeDocument } from "@/types";

export const Route = createFileRoute("/documents")({
  loader: ({ context }) => context.queryClient.ensureQueryData(documentsQuery()),
  head: () => ({
    meta: [
      { title: "Documents — RAGBench" },
      {
        name: "description",
        content: "Upload, index and manage the knowledge base powering your RAG pipelines.",
      },
      { property: "og:title", content: "Knowledge Base — RAGBench" },
      { property: "og:description", content: "Upload, index and manage RAG knowledge base documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
  errorComponent: ({ error }) => (
    <AppShell title="Documents">
      <div role="alert" className="panel p-6 text-sm text-destructive">
        Failed to load documents: {error.message}
      </div>
    </AppShell>
  ),
});

function UploadZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload documents"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-card/50 px-6 py-10 text-center transition-colors",
        dragging && "border-primary bg-primary/5",
        uploading && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
        <CloudUpload className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {uploading ? (
          "Uploading…"
        ) : (
          <>
            Drop files here or <span className="text-primary">browse</span>
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">PDF, DOCX, TXT or MD · up to 50 MB per file</p>
    </div>
  );
}

function DocumentDrawer({
  document,
  onClose,
}: {
  document: KnowledgeDocument | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {document && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-muted-foreground" />
                {document.name}
              </SheetTitle>
              <SheetDescription>
                Index metadata and processing details for this document.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6 px-4 pb-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </h4>
                <div className="mt-2">
                  <DocumentStatusBadge status={document.status} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                {(
                  [
                    ["File type", document.type.toUpperCase()],
                    ["File size", formatBytes(document.sizeBytes)],
                    ["Pages", document.pages > 0 ? String(document.pages) : "—"],
                    ["Chunks", document.chunks > 0 ? document.chunks.toLocaleString() : "—"],
                    ["Embedding model", document.embeddingModel],
                    ["Indexed at", formatDate(document.indexedAt)],
                    ["Last updated", formatDate(document.updatedAt)],
                    [
                      "Processing time",
                      document.processingTimeMs ? formatDuration(document.processingTimeMs) : "—",
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 break-words text-sm font-medium text-foreground">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {document.status === "failed" && (
                <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
                  {document.errorMessage
                    ? `Indexing failed: ${document.errorMessage}`
                    : "Indexing failed: the document contains scanned pages without an extractable text layer or is unreadable. Re-index with OCR or valid text."}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DocumentsPage() {
  const { data: documents } = useSuspenseQuery(documentsQuery());
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => documentService.upload(files),
    onSuccess: async (created) => {
      toast.success(
        `Uploaded ${created.length} document${created.length === 1 ? "" : "s"} — indexing will start automatically.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) =>
      toast.error(err.message || "Upload failed. Check the backend connection."),
  });

  const reindexMutation = useMutation({
    mutationFn: (id: string) => documentService.reindex(id),
    onMutate: (id) => {
      setPendingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: async () => {
      toast.success("Re-indexing started.");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Re-index failed."),
    onSettled: (_data, _err, id) => {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentService.remove(id),
    onSuccess: async () => {
      toast.success("Document deleted from the index.");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Delete failed."),
  });

  return (
    <AppShell title="Documents">
      <PageHeader
        title="Knowledge Base"
        description="Upload, index and manage the documents your RAG pipeline retrieves from."
      />

      <UploadZone
        uploading={uploadMutation.isPending}
        onFiles={(files) => uploadMutation.mutate(files)}
      />

      <div className="panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Chunks</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Indexed At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground">{document.name}</span>
                  </div>
                </TableCell>
                <TableCell className="uppercase text-muted-foreground">{document.type}</TableCell>
                <TableCell className="num text-muted-foreground">
                  {formatBytes(document.sizeBytes)}
                </TableCell>
                <TableCell className="num text-right text-muted-foreground">
                  {document.chunks > 0 ? document.chunks.toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge
                    status={pendingIds.has(document.id) ? "processing" : document.status}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(document.indexedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`View ${document.name}`}
                      onClick={() => setSelected(document)}
                    >
                      <Eye className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Re-index ${document.name}`}
                      disabled={reindexMutation.isPending}
                      onClick={() => reindexMutation.mutate(document.id)}
                    >
                      <RefreshCw className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      aria-label={`Delete ${document.name}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(document.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DocumentDrawer document={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}