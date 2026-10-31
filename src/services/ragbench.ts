/**
 * RAGBench service layer.
 * One function per backend endpoint. Components/hooks call these — never fetch directly.
 * Each call passes a mock fixture used only while the backend is unreachable.
 */
import * as mock from "@/mock";
import type {
  DashboardSummary,
  EvaluationDataset,
  EvaluationResult,
  EvaluationRun,
  Experiment,
  Failure,
  KnowledgeDocument,
  ModelEntry,
  RAGAnswer,
  RAGConfiguration,
  Recommendation,
} from "@/types";
import {
  API_BASE_URL,
  ApiError,
  USE_MOCK_TRANSPORT,
  endpoints,
  request,
} from "./api-client";

export const dashboardService = {
  get: () =>
    request<DashboardSummary>(endpoints.dashboard, { mock: mock.dashboard, mockDelayMs: 320 }),
};

export const documentService = {
  list: () => request<KnowledgeDocument[]>(endpoints.documents, { mock: mock.documents }),

  /**
   * Upload real File objects as multipart/form-data.
   * Uses mock transport ONLY when VITE_API_BASE_URL is unset.
   * If the backend is configured but fails, the error is thrown (no fake success).
   */
  upload: async (files: File[]): Promise<KnowledgeDocument[]> => {
    if (USE_MOCK_TRANSPORT) {
      console.warn(
        "[documentService] MOCK MODE: VITE_API_BASE_URL is not set, so nothing is sent to a backend.",
      );
      await new Promise((r) => setTimeout(r, 700));
      return files.map((file, index) => ({
        id: `doc-new-${index}`,
        name: file.name,
        type: (file.name.split(".").pop() ?? "txt") as KnowledgeDocument["type"],
        sizeBytes: file.size,
        pages: 0,
        chunks: 0,
        status: "processing" as const,
        embeddingModel: mock.activeConfiguration.embeddingModel,
        indexedAt: null,
        updatedAt: new Date().toISOString(),
        processingTimeMs: null,
      }));
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file, file.name);
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoints.documentUpload}`, {
        method: "POST",
        // Do NOT set Content-Type — the browser sets multipart/form-data with boundary automatically
        body: formData,
      });
    } catch (err) {
      console.error("[documentService] Upload request failed", err);
      throw new ApiError(
        "Cannot reach the backend. Check that it is running and that CORS allows this origin.",
        0,
        endpoints.documentUpload,
      );
    }

    if (!response.ok) {
      const detail = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(
        typeof detail.detail === "string" ? detail.detail : response.statusText,
        response.status,
        endpoints.documentUpload,
      );
    }
    return (await response.json()) as KnowledgeDocument[];
  },

  reindex: (id: string) =>
    request<{ ok: true }>(endpoints.documentReindex(id), {
      method: "POST",
      mock: { ok: true } as const,
      mockDelayMs: 500,
    }),
  remove: (id: string) =>
    request<{ ok: true }>(endpoints.document(id), {
      method: "DELETE",
      mock: { ok: true } as const,
      mockDelayMs: 400,
    }),
};

export const ragService = {
  configurations: () =>
    request<RAGConfiguration[]>(endpoints.ragConfigurations, { mock: mock.configurations }),
  saveConfiguration: (configuration: RAGConfiguration) =>
    request<RAGConfiguration>(endpoints.ragConfigurations, {
      method: "POST",
      body: configuration,
      mock: configuration,
      mockDelayMs: 450,
    }),
  query: (payload: { question: string; configuration: RAGConfiguration }) =>
    request<RAGAnswer>(endpoints.ragQuery, {
      method: "POST",
      body: payload,
      mockDelayMs: 1_400,
      mock: () => ({
        ...mock.sampleAnswer,
        id: `ans-${payload.question.length}`,
        question: payload.question,
        configurationId: payload.configuration.id,
      }),
    }),
};

export const evaluationService = {
  list: () => request<EvaluationRun[]>(endpoints.evaluations, { mock: mock.evaluationRuns }),
  get: (id: string) =>
    request<EvaluationRun>(endpoints.evaluation(id), {
      mock: () =>
        mock.evaluationRuns.find((run) => run.id === id) ?? mock.evaluationRuns[0]!,
    }),
  results: (id: string) =>
    request<EvaluationResult[]>(endpoints.evaluationResults(id), {
      mock: () => mock.evaluationResults.map((result) => ({ ...result, runId: id })),
    }),
  run: (payload: { datasetId: string; configurationId: string; questions: number }) =>
    request<EvaluationRun>(endpoints.evaluationRun, {
      method: "POST",
      body: payload,
      mockDelayMs: 600,
      mock: () => mock.evaluationRuns[0]!,
    }),
};

export const experimentService = {
  list: () => request<Experiment[]>(endpoints.experiments, { mock: mock.experiments }),
  create: (payload: Partial<Experiment>) =>
    request<Experiment>(endpoints.experiments, {
      method: "POST",
      body: payload,
      mockDelayMs: 600,
      mock: () => ({ ...mock.experiments[0]!, ...payload, id: "RAG-005", status: "queued" }),
    }),
  compare: (ids: string[]) =>
    request<Experiment[]>(endpoints.experimentsCompare, {
      query: { ids: ids.join(",") },
      mock: () => mock.experiments.filter((experiment) => ids.includes(experiment.id)),
    }),
};

export const failureService = {
  list: () =>
    request<{
      failures: Failure[];
      breakdown: typeof mock.failureBreakdown;
      trend: typeof mock.failureTrend;
      total: number;
    }>(endpoints.failures, {
      mock: {
        failures: mock.failures,
        breakdown: mock.failureBreakdown,
        trend: mock.failureTrend,
        total: mock.totalFailures,
      },
    }),
  recommendations: () =>
    request<Recommendation[]>(endpoints.recommendations, { mock: [mock.recommendation] }),
};

export const datasetService = {
  list: () => request<EvaluationDataset[]>(endpoints.datasets, { mock: mock.datasets }),
};

export const modelService = {
  list: () => request<ModelEntry[]>(endpoints.models, { mock: mock.models }),
};