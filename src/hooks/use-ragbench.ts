import { queryOptions } from "@tanstack/react-query";
import {
  dashboardService,
  datasetService,
  documentService,
  evaluationService,
  experimentService,
  failureService,
  modelService,
  ragService,
} from "@/services/ragbench";

export const dashboardQuery = () =>
  queryOptions({ queryKey: ["dashboard"], queryFn: () => dashboardService.get() });

export const documentsQuery = () =>
  queryOptions({ queryKey: ["documents"], queryFn: () => documentService.list() });

export const configurationsQuery = () =>
  queryOptions({ queryKey: ["rag", "configurations"], queryFn: () => ragService.configurations() });

export const evaluationsQuery = () =>
  queryOptions({ queryKey: ["evaluations"], queryFn: () => evaluationService.list() });

export const evaluationQuery = (id: string) =>
  queryOptions({ queryKey: ["evaluations", id], queryFn: () => evaluationService.get(id) });

export const evaluationResultsQuery = (id: string) =>
  queryOptions({
    queryKey: ["evaluations", id, "results"],
    queryFn: () => evaluationService.results(id),
  });

export const experimentsQuery = () =>
  queryOptions({ queryKey: ["experiments"], queryFn: () => experimentService.list() });

export const failuresQuery = () =>
  queryOptions({ queryKey: ["failures"], queryFn: () => failureService.list() });

export const recommendationsQuery = () =>
  queryOptions({ queryKey: ["recommendations"], queryFn: () => failureService.recommendations() });

export const datasetsQuery = () =>
  queryOptions({ queryKey: ["datasets"], queryFn: () => datasetService.list() });

export const modelsQuery = () =>
  queryOptions({ queryKey: ["models"], queryFn: () => modelService.list() });
