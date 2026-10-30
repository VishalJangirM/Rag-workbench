import type { EvaluationDataset } from "@/types";
import { API_BASE_URL, ApiError, endpoints } from "./api-client";

export interface NewDatasetInput {
  name: string;
  description: string;
  questions: Array<{
    question: string;
    expectedAnswer: string;
    source?: string;
    difficulty?: string;
    category?: string;
  }>;
}

async function send(path: string, init: RequestInit): Promise<EvaluationDataset> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(
      "Cannot reach the backend. Check that it is running and that CORS allows this origin.",
      0,
      path,
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail =
      body && typeof body.detail === "string"
        ? body.detail
        : response.statusText || `Request failed (${response.status})`;
    throw new ApiError(detail, response.status, path);
  }
  return (await response.json()) as EvaluationDataset;
}

export const datasetAdminService = {
  create: (payload: NewDatasetInput) =>
    send(endpoints.datasets, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  importFile: (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file, file.name);
    if (name) form.append("name", name);
    return send(`${endpoints.datasets}/import`, { method: "POST", body: form });
  },
};