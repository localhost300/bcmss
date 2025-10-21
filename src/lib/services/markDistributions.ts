import type { ExamMarkDistribution } from "@/lib/data";
import { getJSON, postJSON } from "@/lib/utils/api";

type ListParams = {
  sessionId?: string;
  term?: "First Term" | "Second Term" | "Third Term";
  examType?: "midterm" | "final";
  schoolId?: string;
};

type UpsertPayload = {
  id?: string;
  sessionId: string;
  term: "First Term" | "Second Term" | "Third Term";
  examType: "midterm" | "final";
  title: string;
  components: Array<{ id: string; label: string; weight: number; order?: number }>;
  schoolId?: string | null;
};

const BASE_URL = "/api/exams/mark-distributions";

const cache = new Map<string, Promise<ExamMarkDistribution[]>>();

const buildCacheKey = (params: ListParams) =>
  JSON.stringify({
    sessionId: params.sessionId ?? null,
    term: params.term ?? null,
    examType: params.examType ?? null,
    schoolId: params.schoolId ?? null,
  });

export async function listMarkDistributions(params: ListParams = {}) {
  const key = buildCacheKey(params);
  if (cache.has(key)) {
    return cache.get(key)!;
  }

  const search = new URLSearchParams();
  if (params.sessionId) search.set("sessionId", params.sessionId);
  if (params.term) search.set("term", params.term);
  if (params.examType) search.set("examType", params.examType);
  if (params.schoolId) search.set("schoolId", params.schoolId);

  const request = getJSON<{ data: ExamMarkDistribution[] }>(
    search.size ? `${BASE_URL}?${search.toString()}` : BASE_URL,
  ).then((response) => response.data);

  cache.set(key, request);
  return request;
}

export function invalidateMarkDistributionCache() {
  cache.clear();
}

export async function upsertMarkDistribution(payload: UpsertPayload) {
  const response = await postJSON<{ data: ExamMarkDistribution }>(BASE_URL, {
    ...payload,
    components: payload.components.map((component, index) => ({
      componentId: component.id,
      label: component.label,
      weight: component.weight,
      order: component.order ?? index,
    })),
  });

  invalidateMarkDistributionCache();
  return response.data;
}
