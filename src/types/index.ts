/**
 * Domain types for RAGBench.
 * These mirror the payloads the FastAPI backend is expected to return.
 * Keep this file free of UI concerns.
 */

export type DocumentStatus =
  | "uploading"
  | "processing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type DocumentType = "pdf" | "docx" | "txt" | "md";

export interface KnowledgeDocument {
  id: string;
  name: string;
  type: DocumentType;
  sizeBytes: number;
  pages: number;
  chunks: number;
  status: DocumentStatus;
  embeddingModel: string;
  indexedAt: string | null;
  updatedAt: string;
  processingTimeMs: number | null;
  errorMessage?: string | null;
}

export type RetrievalStrategy = "vector" | "bm25" | "hybrid";
export type RerankerOption = "disabled" | "cross-encoder" | "custom";

export interface RAGConfiguration {
  id: string;
  name: string;
  embeddingModel: string;
  retrievalStrategy: RetrievalStrategy;
  topK: number;
  chunkSize: 250 | 500 | 750 | 1000;
  chunkOverlap: number;
  reranker: RerankerOption;
  llm: string;
  temperature: number;
  isActive?: boolean;
}

export interface RetrievedChunk {
  id: string;
  documentName: string;
  page: number;
  chunkId: string;
  similarity: number;
  text: string;
}

export interface RAGAnswer {
  id: string;
  question: string;
  answer: string;
  chunks: RetrievedChunk[];
  confidence: number;
  faithfulness: number;
  latencyMs: number;
  tokens: { prompt: number; completion: number };
  costUsd: number;
  configurationId: string;
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  answer?: RAGAnswer;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface DatasetQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  source: string;
  evidence: string;
  difficulty: Difficulty;
  category: string;
}

export interface EvaluationDataset {
  id: string;
  name: string;
  description: string;
  totalQuestions: number;
  breakdown: Record<Difficulty, number>;
  categories: string[];
  updatedAt: string;
  questions: DatasetQuestion[];
}

export interface MetricValue {
  key: string;
  label: string;
  value: number;
  format: "percent" | "seconds" | "currency" | "number";
  delta?: number;
  tooltip: string;
  polarity?: "higher-better" | "lower-better";
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface EvaluationRun {
  id: string;
  label: string;
  status: RunStatus;
  datasetId: string;
  datasetName: string;
  configurationName: string;
  questions: number;
  startedAt: string;
  durationMs: number;
  retrieval: MetricValue[];
  generation: MetricValue[];
  performance: MetricValue[];
}

export type ResultStatus = "pass" | "warn" | "fail";

export type FailureType =
  | "retrieval_failure"
  | "generation_failure"
  | "hallucination"
  | "context_irrelevance"
  | "citation_error"
  | "other";

export interface EvaluationResult {
  id: string;
  runId: string;
  question: string;
  expectedAnswer: string;
  generatedAnswer: string;
  retrievalScore: number;
  correctness: number;
  faithfulness: number;
  contextRelevance: number;
  latencyMs: number;
  status: ResultStatus;
  failureType?: FailureType;
  diagnosis?: string;
  chunks: RetrievedChunk[];
}

export interface Experiment {
  id: string;
  name: string;
  model: string;
  embedding: string;
  retrieval: string;
  reranker: string;
  accuracy: number;
  faithfulness: number;
  recall: number;
  latencySeconds: number;
  costUsd: number;
  overallScore: number;
  status: RunStatus;
  createdAt: string;
  isBest?: boolean;
}

export type ModelKind = "llm" | "embedding" | "reranker";

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  kind: ModelKind;
  contextWindow: number;
  avgLatencySeconds: number;
  costPer1kTokensUsd: number;
  benchmarkScore: number;
  enabled: boolean;
}

export type Severity = "low" | "medium" | "high" | "critical";

export interface Failure {
  id: string;
  question: string;
  failureType: FailureType;
  severity: Severity;
  experiment: string;
  runId: string;
  detectedAt: string;
}

export interface FailureBreakdown {
  type: FailureType;
  label: string;
  count: number;
  share: number;
}

export interface Recommendation {
  id: string;
  title: string;
  summary: string;
  bottleneck: string;
  impact: "low" | "medium" | "high";
  suggestions: string[];
}

export interface TrendPoint {
  run: string;
  overall: number;
  retrieval: number;
  generation: number;
  faithfulness: number;
}

export interface ScatterPoint {
  experiment: string;
  latency: number;
  accuracy: number;
  cost: number;
}

export interface FailureTrendPoint {
  date: string;
  retrieval: number;
  hallucination: number;
  contextIrrelevance: number;
  citation: number;
}

export interface DashboardSummary {
  kpis: MetricValue[];
  scoreTrend: TrendPoint[];
  experimentComparison: Experiment[];
  accuracyVsLatency: ScatterPoint[];
  failureBreakdown: FailureBreakdown[];
  recommendation: Recommendation;
  activeConfiguration: RAGConfiguration;
  activeDataset: { id: string; name: string; questions: number };
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  /** ISO date (yyyy-mm-dd). */
  memberSince: string;
}

export interface UserStats {
  evaluationsRun: number;
  experiments: number;
  documents: number;
  queriesEvaluated: number;
}
