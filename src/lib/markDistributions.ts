"use client";

import { examMarkDistributions, type ExamMarkDistribution } from "@/lib/data";

const STORAGE_KEY = "bcw_mark_distributions";

const baseDistributions = examMarkDistributions;

const distributionKey = (distribution: Pick<ExamMarkDistribution, "examType" | "sessionId" | "term">) =>
  `${distribution.examType}|${distribution.sessionId}|${distribution.term}`;

const mergeDistributions = (
  base: ExamMarkDistribution[],
  overrides: ExamMarkDistribution[],
): ExamMarkDistribution[] => {
  const map = new Map<string, ExamMarkDistribution>();
  base.forEach((distribution) => {
    map.set(distributionKey(distribution), distribution);
  });
  overrides.forEach((distribution) => {
    map.set(distributionKey(distribution), distribution);
  });
  return Array.from(map.values());
};

const mergeOverrides = (
  existing: ExamMarkDistribution[],
  overrides: ExamMarkDistribution[],
): ExamMarkDistribution[] => {
  const map = new Map<string, ExamMarkDistribution>();
  existing.forEach((distribution) => map.set(distributionKey(distribution), distribution));
  overrides.forEach((distribution) => map.set(distributionKey(distribution), distribution));
  return Array.from(map.values());
};

let cachedOverrides: ExamMarkDistribution[] | null = null;
let cachedMerged: ExamMarkDistribution[] | null = null;

export const loadDistributionOverrides = (): ExamMarkDistribution[] => {
  if (cachedOverrides) {
    return cachedOverrides;
  }

  if (typeof window === "undefined") {
    cachedOverrides = [];
    return cachedOverrides;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cachedOverrides = [];
      return cachedOverrides;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedOverrides = [];
      return cachedOverrides;
    }
    cachedOverrides = parsed as ExamMarkDistribution[];
    return cachedOverrides;
  } catch (error) {
    console.error("[markDistributions] Failed to load overrides", error);
    cachedOverrides = [];
    return cachedOverrides;
  }
};

export const getExamDistributions = (): ExamMarkDistribution[] => {
  if (cachedMerged) {
    return cachedMerged;
  }

  const overrides = loadDistributionOverrides();
  cachedMerged = mergeDistributions(baseDistributions, overrides);
  return cachedMerged;
};

export const saveExamDistribution = (distribution: ExamMarkDistribution) => {
  const overrides = mergeOverrides(loadDistributionOverrides(), [distribution]);
  cachedOverrides = overrides;
  cachedMerged = mergeDistributions(baseDistributions, overrides);

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    window.dispatchEvent(new CustomEvent("mark-distributions-updated"));
  } catch (error) {
    console.error("[markDistributions] Failed to persist distribution overrides", error);
  }
};

export const clearExamDistributionOverrides = () => {
  cachedOverrides = [];
  cachedMerged = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("mark-distributions-updated"));
    } catch (error) {
      console.error("[markDistributions] Failed to clear distribution overrides", error);
    }
  }
};
