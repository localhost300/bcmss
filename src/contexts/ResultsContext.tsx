"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { useSchoolScope } from "@/contexts/SchoolContext";
import { useSessionScope, useTermScope } from "@/contexts/SessionContext";
import {
  getGradeForMidtermScore,
  getGradeForScore,
  type GradeSummary,
} from "@/lib/grades";
import type { ExamMarkDistribution } from "@/lib/data";
import { listMarkDistributions } from "@/lib/services/markDistributions";
import { getJSON, postJSON } from "@/lib/utils/api";

export type Term = "First Term" | "Second Term" | "Third Term";

type ScoreComponent = {
  componentId: string;
  label: string;
  score: number;
  maxScore: number | null;
};

type ScoreRecord = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  subject: string;
  examType: "midterm" | "final";
  term: string;
  sessionId: string;
  components: ScoreComponent[];
  totalScore: number;
  maxScore: number;
  percentage: number;
};

export type ScoreSheetRow = ScoreRecord;

export type ScoreComponentDefinition = {
  componentId: string;
  label: string;
  maxScore: number | null;
  order: number;
};

export type StudentResultSummary = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  averageScore: number;
  grade: string;
  remark: string;
  position: number;
  sessionId: string;
  term: string;
};

export type PromotionCandidate = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  nextClassId: string | null;
  nextClassName: string | null;
  averageScore: number;
  grade: string;
  remark: string;
  autoPromoted: boolean;
  decision: "auto" | "promote" | "hold";
  promoted: boolean;
};

type ClassFilters = {
  classId: string;
  term: Term;
  sessionId: string;
};

type SubjectFilters = ClassFilters & {
  examType: "midterm" | "final";
};

type ScoreFilters = SubjectFilters & {
  subject: string;
};

type ClassOption = { id: string; name: string };

const EXAM_TYPE_ORDER: Array<"final" | "midterm"> = ["final", "midterm"];

const TERM_LABEL_TO_ENUM: Record<Term, "FIRST" | "SECOND" | "THIRD"> = {
  "First Term": "FIRST",
  "Second Term": "SECOND",
  "Third Term": "THIRD",
};

const mapTermLabelToEnum = (term: Term): "FIRST" | "SECOND" | "THIRD" | undefined =>
  TERM_LABEL_TO_ENUM[term];

type ResultsContextValue = {
  classOptions: ClassOption[];
  classOptionsLoading: boolean;
  classOptionsError: string | null;
  loadClassData: (filters: ClassFilters) => Promise<void>;
  isClassLoading: (filters: ClassFilters) => boolean;
  getClassError: (filters: ClassFilters) => string | null;
  isClassLoaded: (filters: ClassFilters) => boolean;
  getSubjectsForClass: (filters: SubjectFilters) => string[];
  getScoreSheets: (filters: ScoreFilters) => ScoreSheetRow[];
  getScoreComponents: (filters: ScoreFilters) => ScoreComponentDefinition[];
  updateScore: (sheetId: string, componentId: string, value: number) => void;
  saveScores: (
    filters: ScoreFilters,
    rows: ScoreSheetRow[],
  ) => Promise<string | undefined>;
  getResultSummaries: (filters: ClassFilters) => StudentResultSummary[];
  getMidtermSummaries: (filters: ClassFilters) => StudentResultSummary[];
  getAvailableExamTypes: (filters: ClassFilters) => Array<"midterm" | "final">;
  getStudentDetails: (
    filters: { studentId: number; term: Term; sessionId: string },
  ) => {
    finals: ScoreSheetRow[];
    midterm: ScoreSheetRow[];
    finalSummary?: StudentResultSummary;
    midtermSummary?: StudentResultSummary;
  };
  gradeForPercentage: (score: number) => GradeSummary;
  gradeForMidterm: (scoreOutOf50: number) => GradeSummary;
  promotionThreshold: number;
  getPromotionCandidates: (filters: ClassFilters) => PromotionCandidate[];
  setPromotionDecision: (
    classId: string,
    studentId: number,
    decision: "auto" | "promote" | "hold",
  ) => void;
  finalizePromotion: (filters: ClassFilters) => PromotionCandidate[];
  markDistributionLoading: boolean;
  markDistributionError: string | null;
  getLockInfo: (
    filters: ClassFilters & { examType: "midterm" | "final" },
  ) => LockInfo | null;
  refreshMarkDistributions: () => Promise<void>;
};

const ResultsContext = createContext<ResultsContextValue | undefined>(
  undefined,
);

const PROMOTION_THRESHOLD = 50;

const buildClassKey = ({ classId, term, sessionId }: ClassFilters) =>
  `${sessionId}|${term}|${classId}`;

const buildSubjectKey = ({
  classId,
  examType,
  term,
  sessionId,
}: SubjectFilters) => `${sessionId}|${term}|${classId}|${examType}`;

const normaliseComponent = (raw: unknown, index: number): ScoreComponent => {
  const record = raw as Record<string, unknown>;
  const componentId =
    typeof record.componentId === "string"
      ? record.componentId
      : `component-${index}`;
  const label = typeof record.label === "string" ? record.label : componentId;
  const score = Number(record.score ?? 0);
  const maxScore =
    typeof record.maxScore === "number"
      ? record.maxScore
      : Number(record.maxScore ?? 0);

  return {
    componentId,
    label,
    score,
    maxScore: Number.isFinite(maxScore) ? maxScore : null,
  };
};

const computeTotals = (components: ScoreComponent[]) =>
  components.reduce(
    (acc, component) => ({
      score: acc.score + component.score,
      max: acc.max + (component.maxScore ?? 0),
    }),
    { score: 0, max: 0 },
  );

const mapScoreRecord = (raw: unknown): ScoreRecord => {
  const record = raw as Record<string, unknown>;
  const examType =
    record.examType === "midterm"
      ? "midterm"
      : record.examType === "final"
      ? "final"
      : "final";
  const components = Array.isArray(record.components)
    ? record.components.map(normaliseComponent)
    : [];

  const totals = computeTotals(components);
  const explicitTotal = Number(record.totalScore ?? totals.score);
  const explicitMax = Number(record.maxScore ?? totals.max);
  const maxScore = Number.isFinite(explicitMax)
    ? explicitMax || (examType === "midterm" ? 50 : 100)
    : examType === "midterm"
    ? 50
    : 100;

  const percentage = Number(
    record.percentage ?? (maxScore ? (explicitTotal / maxScore) * 100 : 0),
  );

  return {
    id: String(
      record.id ?? `${record.studentId ?? ""}-${record.subject ?? ""}-${examType}`,
    ),
    studentId: Number(record.studentId ?? 0),
    studentName: String(record.studentName ?? "Unnamed Student"),
    classId: String(record.classId ?? ""),
    className: String(record.className ?? ""),
    subject: String(record.subject ?? "Subject"),
    examType,
    term: String(record.term ?? ""),
    sessionId: String(record.sessionId ?? ""),
    components,
    totalScore: explicitTotal,
    maxScore,
    percentage,
  };
};

const DEFAULT_MIDTERM_MAX = 50;
const DEFAULT_FINAL_MAX = 100;

const buildDefaultComponentsForExam = (examType: "midterm" | "final"): ScoreComponent[] => {
  const maxScore = examType === "midterm" ? DEFAULT_MIDTERM_MAX : DEFAULT_FINAL_MAX;
  return [
    {
      componentId: "exam",
      label: "Exam",
      score: 0,
      maxScore,
    },
  ];
};

type LockInfo = {
  id: number;
  classId: number;
  sessionId: string;
  term: Term;
  examType: "midterm" | "final";
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  allowedTeacherIds: number[];
  notes: string | null;
};

const buildRecordKey = (record: ScoreRecord) =>
  [
    record.sessionId,
    record.term,
    record.classId,
    record.subject,
    record.studentId,
    record.examType,
  ].join("|");

const buildMidtermKey = (record: ScoreRecord) =>
  [record.sessionId, record.term, record.classId, record.subject, record.studentId].join("|");

const clampScore = (value: number, max: number | null | undefined) => {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(max ?? NaN) || max == null) return value;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(value, max));
};

const COMPONENT_ORDER: Record<string, number> = {
  midtermCarry: 0,
  ca1: 1,
  classParticipation: 2,
  quiz: 3,
  assignment: 4,
  ca2: 5,
  exam: 6,
};

const resolveComponentOrder = (componentId: string, fallback: number) =>
  COMPONENT_ORDER[componentId] ?? fallback;

const normaliseComponentLabel = (componentId: string, label: string) => {
  if (componentId === "midtermCarry") {
    return "Aggregated Midterm Score";
  }
  return label;
};

const findMatchingMarkDistribution = (
  distributions: ExamMarkDistribution[],
  params: { examType: "midterm" | "final"; sessionId: string; term: string },
): ExamMarkDistribution | undefined =>
  distributions.find(
    (distribution) =>
      distribution.examType === params.examType &&
      distribution.sessionId === params.sessionId &&
      distribution.term === params.term,
  ) ??
  distributions.find(
    (distribution) =>
      distribution.examType === params.examType && distribution.sessionId === params.sessionId,
  ) ??
  distributions.find(
    (distribution) =>
      distribution.examType === params.examType && distribution.term === params.term,
  ) ??
  distributions.find((distribution) => distribution.examType === params.examType);

const alignRecordsWithMarkDistributions = (
  records: ScoreRecord[],
  distributions: ExamMarkDistribution[],
): ScoreRecord[] => {
  if (!records.length) return records;

  const midtermTotals = new Map<string, { score: number; max: number }>();
  const alignedByKey = new Map<string, ScoreRecord>();
  const pool = distributions;

  const normaliseRecord = (
    record: ScoreRecord,
    distribution: ExamMarkDistribution | undefined,
    opts: { midtermTotals?: Map<string, { score: number; max: number }> },
  ): ScoreRecord => {
    if (!distribution) {
      return record;
    }

    const components = distribution.components.map((distributionComponent) => {
      const existing =
        record.components.find(
          (component) => component.componentId === distributionComponent.id,
        ) ??
        record.components.find(
          (component) =>
            component.label.toLowerCase() === distributionComponent.label.toLowerCase(),
        );

      const maxScore = distributionComponent.weight;
      const score = clampScore(existing?.score ?? 0, maxScore);

      return {
        componentId: distributionComponent.id,
        label: distributionComponent.label,
        score,
        maxScore,
      };
    });

    const maxScore =
      components.reduce((sum, component) => sum + (component.maxScore ?? 0), 0) ||
      (record.examType === "midterm" ? DEFAULT_MIDTERM_MAX : DEFAULT_FINAL_MAX);

    if (record.examType === "midterm") {
      const totalScore = components.reduce((sum, component) => sum + component.score, 0);
      opts.midtermTotals?.set(buildMidtermKey(record), { score: totalScore, max: maxScore });
      const percentage = maxScore ? (totalScore / maxScore) * 100 : 0;
      return {
        ...record,
        components,
        totalScore,
        maxScore,
        percentage,
      };
    }

    if (record.examType === "final") {
      const finalComponents = components.map((component) => {
        if (component.componentId === "midtermCarry") {
          const totals = opts.midtermTotals?.get(buildMidtermKey(record));
          if (totals && totals.max > 0) {
            const carry = (totals.score / totals.max) * (component.maxScore ?? 0);
            return {
              ...component,
              score: clampScore(carry, component.maxScore),
            };
          }
        }

        const existing =
          record.components.find((item) => item.componentId === component.componentId) ??
          record.components.find(
            (item) => item.label.toLowerCase() === component.label.toLowerCase(),
          );

        return {
          ...component,
          score: clampScore(existing?.score ?? component.score ?? 0, component.maxScore),
        };
      });

      const totalScore = finalComponents.reduce((sum, component) => sum + component.score, 0);
      const finalMaxScore =
        finalComponents.reduce((sum, component) => sum + (component.maxScore ?? 0), 0) ||
        DEFAULT_FINAL_MAX;
      const percentage = finalMaxScore ? (totalScore / finalMaxScore) * 100 : 0;

      return {
        ...record,
        components: finalComponents,
        totalScore,
        maxScore: finalMaxScore,
        percentage,
      };
    }

    const totalScore = components.reduce((sum, component) => sum + component.score, 0);
    const percentage = maxScore ? (totalScore / maxScore) * 100 : 0;
    return {
      ...record,
      components,
      totalScore,
      maxScore,
      percentage,
    };
  };

  const midtermRecords = records.filter((record) => record.examType === "midterm");
  const finalRecords = records.filter((record) => record.examType === "final");

  midtermRecords.forEach((record) => {
    const distribution = findMatchingMarkDistribution(pool, {
      examType: record.examType,
      sessionId: record.sessionId,
      term: record.term,
    });
    const aligned = normaliseRecord(record, distribution, { midtermTotals });
    alignedByKey.set(buildRecordKey(record), aligned);
  });

  finalRecords.forEach((record) => {
    const distribution = findMatchingMarkDistribution(pool, {
      examType: record.examType,
      sessionId: record.sessionId,
      term: record.term,
    });
    const aligned = normaliseRecord(record, distribution, { midtermTotals });
    alignedByKey.set(buildRecordKey(record), aligned);
  });

  return records.map((record) => alignedByKey.get(buildRecordKey(record)) ?? record);
};

const studentDecisionKey = (classId: string, studentId: number) =>
  `${classId}|${studentId}`;

type ResultsProviderProps = { children: React.ReactNode };

export const ResultsProvider = ({ children }: ResultsProviderProps) => {
  const schoolScope = useSchoolScope();
  const termScope = useTermScope();
  const sessionScope = useSessionScope();
  const { user } = useAuth();
  const userRole: UserRole = user?.role ?? "teacher";
  const isParentOrStudent = userRole === "parent" || userRole === "student";

  const term = termScope ?? "First Term";

  const [markDistributions, setMarkDistributions] = useState<ExamMarkDistribution[]>([]);
  const [markDistributionLoading, setMarkDistributionLoading] = useState(false);
  const [markDistributionError, setMarkDistributionError] = useState<string | null>(null);

  const fetchMarkDistributions = useCallback(async () => {
    if (!schoolScope) {
      return [] as ExamMarkDistribution[];
    }

    const data = await listMarkDistributions({
      schoolId: schoolScope,
      sessionId: sessionScope ?? undefined,
      term: termScope ?? undefined,
    });
    return data;
  }, [schoolScope, sessionScope, termScope]);

  const refreshMarkDistributions = useCallback(async () => {
    setMarkDistributionLoading(true);
    setMarkDistributionError(null);
    try {
      if (!schoolScope) {
        setMarkDistributions([]);
        return;
      }
      const data = await fetchMarkDistributions();
      setMarkDistributions(data);
    } catch (error) {
      console.error("[ResultsContext] Failed to load mark distributions", error);
      setMarkDistributions([]);
      setMarkDistributionError("Unable to load mark distributions.");
    } finally {
      setMarkDistributionLoading(false);
    }
  }, [fetchMarkDistributions, schoolScope]);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setMarkDistributionLoading(true);
      setMarkDistributionError(null);
      try {
        if (!schoolScope) {
          if (!ignore) {
            setMarkDistributions([]);
          }
          return;
        }
        const data = await fetchMarkDistributions();
        if (!ignore) {
          setMarkDistributions(data);
        }
      } catch (error) {
        console.error("[ResultsContext] Failed to load mark distributions", error);
        if (!ignore) {
          setMarkDistributions([]);
          setMarkDistributionError("Unable to load mark distributions.");
        }
      } finally {
        if (!ignore) {
          setMarkDistributionLoading(false);
        }
      }
    };

    void load();
    return () => {
      ignore = true;
    };
  }, [fetchMarkDistributions, schoolScope]);

  useEffect(() => {
    setClassRecords((prev) => {
      const next: Record<string, ScoreRecord[]> = {};
      Object.entries(prev).forEach(([key, records]) => {
        next[key] = alignRecordsWithMarkDistributions(records, markDistributions);
      });
      return next;
    });
  }, [markDistributions]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [classOptionsLoading, setClassOptionsLoading] = useState(false);
  const [classOptionsError, setClassOptionsError] = useState<string | null>(
    null,
  );

  const [classRecords, setClassRecords] = useState<Record<string, ScoreRecord[]>>(
    {},
  );
  const [classLoading, setClassLoading] = useState<Record<string, boolean>>({});
  const [classErrors, setClassErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [classExamTypes, setClassExamTypes] = useState<
    Record<string, Array<"midterm" | "final">>
  >({});
  const subjectAssignmentsRef = useRef<Record<string, string[]>>({});
  const [subjectsCache, setSubjectsCache] = useState<Record<string, string[]>>(
    {},
  );
  const [draftScores, setDraftScores] = useState<
    Record<string, Record<string, number>>
  >({});
  const [promotionDecisions, setPromotionDecisions] = useState<
    Record<string, "promote" | "hold">
  >({});
  const [classLocks, setClassLocks] = useState<
    Record<string, Partial<Record<"midterm" | "final", LockInfo | null>>>
  >({});

  useEffect(() => {
    let ignore = false;

    const loadClassOptions = async () => {
      setClassOptionsLoading(true);
      setClassOptionsError(null);
      try {
        const params = new URLSearchParams();
        params.set("pageSize", "200");
        if (schoolScope) {
          params.set("schoolId", schoolScope);
        }
        const response = await getJSON<
          { items?: Array<{ id: number; name: string }> }
        >(`/api/classes?${params.toString()}`);
        if (ignore) return;

        const items = response?.items ?? [];
        const mapped = items
          .map((cls) => ({ id: String(cls.id), name: cls.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setClassOptions(mapped);
      } catch (error) {
        if (ignore) return;
        console.error("[ResultsContext] Unable to load classes", error);
        setClassOptions([]);
        setClassOptionsError(
          error instanceof Error ? error.message : "Unable to load class list.",
        );
      } finally {
        if (!ignore) {
          setClassOptionsLoading(false);
        }
      }
    };

    void loadClassOptions();
    return () => {
      ignore = true;
    };
  }, [schoolScope]);

  const loadClassData = useCallback(
    async ({ classId, term, sessionId }: ClassFilters) => {
      if (!classId || !sessionId) {
        return;
      }
      const key = buildClassKey({ classId, term, sessionId });

      let shouldSkip = false;
      setClassLoading((prev) => {
        if (prev[key]) {
          shouldSkip = true;
          return prev;
        }
        return { ...prev, [key]: true };
      });
      if (shouldSkip) {
        return;
      }

      setClassErrors((prev) => ({ ...prev, [key]: null }));

      try {
        const params = new URLSearchParams();
        params.set("classId", classId);
        params.set("term", term);
        params.set("sessionId", sessionId);

        const response = await getJSON<unknown>(`/api/results/scores?${params.toString()}`);

        const extractRecords = (body: unknown): unknown[] => {
          if (Array.isArray(body)) {
            return body;
          }
          if (body && typeof body === "object") {
            const container = body as { data?: unknown; items?: unknown };
            if (Array.isArray(container.data)) {
              return container.data as unknown[];
            }
            if (Array.isArray(container.items)) {
              return container.items as unknown[];
            }
          }
          return [];
        };

        const rawRecords = extractRecords(response).map(mapScoreRecord);
        let records = alignRecordsWithMarkDistributions(rawRecords, markDistributions);
        const responseObject =
          response && typeof response === "object"
            ? (response as Record<string, unknown>)
            : null;
        const lockEntriesRaw = responseObject?.locks;
        const parsedLocks: Partial<Record<"midterm" | "final", LockInfo | null>> = {
          midterm: null,
          final: null,
        };
        const numericClassId = Number(classId);
        if (Array.isArray(lockEntriesRaw)) {
          lockEntriesRaw.forEach((entry) => {
            if (!entry || typeof entry !== "object") {
              return;
            }
            const record = entry as Record<string, unknown>;
            const entryClassId =
              typeof record.classId === "number"
                ? record.classId
                : typeof record.classId === "string"
                ? Number(record.classId)
                : NaN;
            if (!Number.isFinite(entryClassId) || entryClassId !== numericClassId) {
              return;
            }
            const entrySessionId =
              typeof record.sessionId === "string" && record.sessionId.length > 0
                ? record.sessionId
                : "";
            if (entrySessionId !== sessionId) {
              return;
            }
            const entryTerm =
              typeof record.term === "string" && record.term.length > 0 ? record.term : "";
            if (entryTerm !== term) {
              return;
            }
            const entryExamTypeRaw =
              typeof record.examType === "string" && record.examType.length > 0
                ? record.examType.toLowerCase()
                : "";
            if (entryExamTypeRaw !== "midterm" && entryExamTypeRaw !== "final") {
              return;
            }
            const allowedTeacherIds = Array.isArray(record.allowedTeacherIds)
              ? (record.allowedTeacherIds as unknown[])
                  .map((value) => {
                    if (typeof value === "number" && Number.isFinite(value)) {
                      return value;
                    }
                    if (typeof value === "string") {
                      const parsed = Number(value);
                      return Number.isFinite(parsed) ? parsed : null;
                    }
                    return null;
                  })
                  .filter((value): value is number => value != null)
              : [];
            parsedLocks[entryExamTypeRaw] = {
              id:
                typeof record.id === "number"
                  ? record.id
                  : typeof record.id === "string"
                  ? Number(record.id)
                  : 0,
              classId: numericClassId,
              sessionId,
              term,
              examType: entryExamTypeRaw,
              isLocked: Boolean(record.isLocked),
              lockedBy:
                typeof record.lockedBy === "string" && record.lockedBy.length > 0
                  ? record.lockedBy
                  : null,
              lockedAt:
                typeof record.lockedAt === "string" && record.lockedAt.length > 0
                  ? record.lockedAt
                  : null,
              allowedTeacherIds,
              notes:
                typeof record.notes === "string" && record.notes.length > 0 ? record.notes : null,
            };
          });
        }

        const examTypeSet = new Set<"midterm" | "final">();
        try {
          const examParams = new URLSearchParams();
          examParams.set("page", "1");
          examParams.set("pageSize", "200");
          examParams.set("sessionId", sessionId);
          const termEnum = mapTermLabelToEnum(term);
          if (termEnum) {
            examParams.set("term", termEnum);
          }
          const examsResponse = await getJSON<{ items?: Array<{ classId: number; examType?: string }> }>(
            `/api/exams?${examParams.toString()}`,
          );
          const examItems = examsResponse?.items ?? [];
          examItems.forEach((item) => {
            if (String(item.classId) === String(classId)) {
              const type = typeof item.examType === "string" ? item.examType.toLowerCase() : "";
              if (type === "midterm" || type === "final") {
                examTypeSet.add(type);
              }
            }
          });
        } catch (examError) {
          console.error("[ResultsContext] Unable to load exam schedule", examError);
        }

        if (!examTypeSet.size) {
          records.forEach((record) => {
            if (record.examType === "midterm" || record.examType === "final") {
              examTypeSet.add(record.examType);
            }
          });
        }

        const orderedExamTypes = EXAM_TYPE_ORDER.filter((type) => examTypeSet.has(type)) as Array<
          "midterm" | "final"
        >;

        let studentsInClass: Array<{
          id: number;
          name: string;
          classId: number | null;
          className: string | null;
        }> = [];
        try {
          const studentParams = new URLSearchParams();
          studentParams.set("page", "1");
          studentParams.set("pageSize", "500");
          studentParams.set("classId", classId);
          if (schoolScope) {
            studentParams.set("schoolId", schoolScope);
          }
          const studentResponse = await getJSON<{
            items?: Array<{ id?: unknown; name?: unknown; classId?: unknown; className?: unknown }>;
          }>(`/api/students?${studentParams.toString()}`);
          const items = Array.isArray(studentResponse?.items) ? studentResponse!.items : [];
          studentsInClass = items
            .map((item) => {
              const rawId = typeof item.id === "number" ? item.id : Number(item.id);
              if (!Number.isFinite(rawId)) {
                return null;
              }
              const classIdValue =
                typeof item.classId === "number"
                  ? item.classId
                  : typeof item.classId === "string"
                  ? Number(item.classId)
                  : null;
              const rawName = typeof item.name === "string" ? item.name : "";
              const classNameValue = typeof item.className === "string" ? item.className : null;
              return {
                id: rawId,
                name: rawName,
                classId: Number.isFinite(classIdValue ?? NaN) ? (classIdValue as number) : null,
                className: classNameValue,
              };
            })
            .filter((entry): entry is { id: number; name: string; classId: number | null; className: string | null } =>
              Boolean(entry),
            );
        } catch (studentError) {
          console.error("[ResultsContext] Unable to load students for class", studentError);
        }

        setClassExamTypes((prev) => ({ ...prev, [key]: orderedExamTypes }));
        setClassLocks((prev) => ({
          ...prev,
          [key]: {
            midterm: parsedLocks.midterm ?? null,
            final: parsedLocks.final ?? null,
          },
        }));

        let fallbackSubjects = subjectAssignmentsRef.current[String(classId)] ?? [];
        if (!fallbackSubjects.length) {
          try {
            const subjectParams = new URLSearchParams();
            subjectParams.set("page", "1");
            subjectParams.set("pageSize", "200");
            if (schoolScope) {
              subjectParams.set("schoolId", schoolScope);
            }
            const subjectResponse = await getJSON<{
              items?: Array<{ name?: unknown; classes?: Array<{ id?: unknown }> }>;
            }>(`/api/subjects?${subjectParams.toString()}`);
            const subjectItems = subjectResponse?.items ?? [];
            fallbackSubjects = subjectItems
              .filter(
                (subject) =>
                  Array.isArray(subject.classes) &&
                  subject.classes.some((klass) => {
                    const klassId = klass.id as string | number | undefined;
                    return String(klassId ?? "") === String(classId);
                  }),
              )
              .map((subject) => {
                const rawName = subject.name;
                return typeof rawName === "string" ? rawName.trim() : "";
              })
              .filter((name) => name.length > 0)
              .sort((a, b) => a.localeCompare(b));
            subjectAssignmentsRef.current[String(classId)] = fallbackSubjects;
          } catch (subjectError) {
            console.error("[ResultsContext] Unable to load class subject catalogue", subjectError);
            fallbackSubjects = [];
          }
        }

        if (!isParentOrStudent && studentsInClass.length && orderedExamTypes.length) {
          const subjectsForPlaceholders =
            fallbackSubjects.length > 0
              ? fallbackSubjects
              : Array.from(new Set(records.map((record) => record.subject)));

          if (subjectsForPlaceholders.length > 0) {
            const existingKeys = new Set(records.map((record) => buildRecordKey(record)));
            const placeholderRawRecords: ScoreRecord[] = [];
            const classIdString = classId;

            studentsInClass.forEach((student) => {
              const studentId = student.id;
              if (!Number.isFinite(studentId)) {
                return;
              }
              const studentName =
                typeof student.name === "string" && student.name.trim()
                  ? student.name.trim()
                  : `Student ${studentId}`;

              subjectsForPlaceholders.forEach((subjectName) => {
                if (!subjectName) {
                  return;
                }
                orderedExamTypes.forEach((examType) => {
                  const defaultComponents = buildDefaultComponentsForExam(examType);
                  const defaultMaxScore =
                    defaultComponents.reduce((sum, component) => sum + (component.maxScore ?? 0), 0) ||
                    (examType === "midterm" ? DEFAULT_MIDTERM_MAX : DEFAULT_FINAL_MAX);

                  const placeholder: ScoreRecord = {
                    id: `placeholder-${studentId}-${subjectName.replace(/\s+/g, "-").toLowerCase()}-${examType}-${sessionId}-${term}`,
                    studentId,
                    studentName,
                    classId: classIdString,
                    className:
                      student.className ??
                      records.find((record) => record.studentId === studentId)?.className ??
                      "",
                    subject: subjectName,
                    examType,
                    term,
                    sessionId,
                    components: defaultComponents,
                    totalScore: 0,
                    maxScore: defaultMaxScore,
                    percentage: 0,
                  };

                  const key = buildRecordKey(placeholder);
                  if (existingKeys.has(key)) {
                    return;
                  }
                  existingKeys.add(key);
                  placeholderRawRecords.push(placeholder);
                });
              });
            });

            if (placeholderRawRecords.length) {
              const combinedRecords = alignRecordsWithMarkDistributions(
                [...records, ...placeholderRawRecords],
                markDistributions,
              );
              records = combinedRecords;
            }
          }
        }

        setClassRecords((prev) => ({ ...prev, [key]: records }));

        setSubjectsCache((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((subjectKey) => {
            if (subjectKey.startsWith(`${sessionId}|${term}|${classId}|`)) {
              delete next[subjectKey];
            }
          });

          records.forEach((record) => {
            const subjectKey = buildSubjectKey({
              classId: record.classId,
              examType: record.examType,
              term: record.term as Term,
              sessionId: record.sessionId,
            });
            const list = new Set(next[subjectKey] ?? []);
            list.add(record.subject);
            next[subjectKey] = Array.from(list).sort();
          });

          if (orderedExamTypes.length) {
            orderedExamTypes.forEach((type) => {
              const subjectKey = buildSubjectKey({
                classId,
                examType: type,
                term,
                sessionId,
              });
              const list = new Set(next[subjectKey] ?? []);
              fallbackSubjects.forEach((subject) => list.add(subject));
              next[subjectKey] = Array.from(list).sort();
            });
          }

          return next;
        });

        setDraftScores((prev) => {
          const next = { ...prev };
          const allowed = new Set(records.map((record) => record.id));
          Object.keys(next).forEach((rowId) => {
            if (!allowed.has(rowId)) {
              delete next[rowId];
            }
          });
          return next;
        });
      } catch (error) {
        console.error("[ResultsContext] Unable to load scores", error);
        setClassErrors((prev) => ({
          ...prev,
          [key]:
            error instanceof Error ? error.message : "Unable to load scores.",
        }));
      } finally {
        setClassLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [markDistributions, schoolScope, isParentOrStudent],
  );

  const isClassLoading = useCallback(
    (filters: ClassFilters) => Boolean(classLoading[buildClassKey(filters)]),
    [classLoading],
  );

  const getClassError = useCallback(
    (filters: ClassFilters) => classErrors[buildClassKey(filters)] ?? null,
    [classErrors],
  );

  const isClassLoaded = useCallback(
    (filters: ClassFilters) => Array.isArray(classRecords[buildClassKey(filters)]),
    [classRecords],
  );

  const getAvailableExamTypes = useCallback(
    (filters: ClassFilters) => classExamTypes[buildClassKey(filters)] ?? [],
    [classExamTypes],
  );

  const getSubjectsForClass = useCallback(
    (filters: SubjectFilters) => subjectsCache[buildSubjectKey(filters)] ?? [],
    [subjectsCache],
  );

  const applyDraft = useCallback(
    (record: ScoreRecord): ScoreSheetRow => {
      const draft = draftScores[record.id];
      if (!draft) {
        return record;
      }

      const components = record.components.map((component) => {
        const nextScore = draft[component.componentId];
        return nextScore == null ? component : { ...component, score: nextScore };
      });

      const totals = computeTotals(components);
      const maxScore =
        record.examType === "midterm"
          ? record.maxScore || 50
          : record.maxScore || 100;

      return {
        ...record,
        components,
        totalScore: totals.score,
        maxScore,
        percentage: maxScore
          ? Math.round((totals.score / maxScore) * 1000) / 10
          : 0,
      };
    },
    [draftScores],
  );

  const getScoreSheets = useCallback(
    (filters: ScoreFilters) => {
      const records = classRecords[buildClassKey(filters)];
      if (!records) {
        return [];
      }

      return records
        .filter(
          (record) =>
            record.examType === filters.examType &&
            record.subject === filters.subject &&
            record.term === filters.term &&
            record.sessionId === filters.sessionId,
        )
        .map(applyDraft)
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
    },
    [applyDraft, classRecords],
  );

  const getScoreComponents = useCallback(
    (filters: ScoreFilters): ScoreComponentDefinition[] => {
      const records = classRecords[buildClassKey(filters)] ?? [];
      const matching = records.filter(
        (record) =>
          record.examType === filters.examType &&
          record.subject === filters.subject &&
          record.term === filters.term &&
          record.sessionId === filters.sessionId,
      );

      const headerMap = new Map<string, ScoreComponentDefinition>();
      matching.forEach((record) => {
        record.components.forEach((component, index) => {
          const maxScore = component.maxScore ?? null;
          const existing = headerMap.get(component.componentId);
          const componentOrder = resolveComponentOrder(component.componentId, index);
          if (existing) {
            const nextOrder = Math.min(existing.order, componentOrder);
            const resolvedMaxScore =
              existing.maxScore == null && maxScore != null ? maxScore : existing.maxScore;
            const nextLabel = existing.label || component.label;
            if (
              nextOrder !== existing.order ||
              resolvedMaxScore !== existing.maxScore ||
              nextLabel !== existing.label
            ) {
              headerMap.set(component.componentId, {
                componentId: component.componentId,
                label: component.label || existing.label,
                maxScore: resolvedMaxScore,
                order: nextOrder,
              });
            }
          } else {
            headerMap.set(component.componentId, {
              componentId: component.componentId,
              label: component.label,
              maxScore,
              order: componentOrder,
            });
          }
        });
      });

      const distribution = findMatchingMarkDistribution(markDistributions, {
        examType: filters.examType,
        sessionId: filters.sessionId,
        term: filters.term,
      });

      if (distribution) {
        const definitions = distribution.components.map((component, index) => {
          const existing = headerMap.get(component.id);
          const weight = Number.isFinite(component.weight) ? component.weight : null;
          const order = resolveComponentOrder(component.id, index);
          return {
            componentId: component.id,
            label: normaliseComponentLabel(component.id, component.label),
            maxScore: existing?.maxScore ?? weight,
            order,
          };
        });

        return definitions;
      }

      return [];
    },
    [classRecords, markDistributions],
  );

  const updateScore = useCallback(
    (sheetId: string, componentId: string, value: number) => {
      setDraftScores((prev) => {
        const next = { ...prev };
        const draft = { ...(next[sheetId] ?? {}) };
        draft[componentId] = value;
        next[sheetId] = draft;
        return next;
      });
    },
    [],
  );

  const saveScores = useCallback(
    async (filters: ScoreFilters, rows: ScoreSheetRow[]) => {
      if (!rows.length) {
        return "No scores to save.";
      }

      const payload = {
        rows: rows.map((row) => ({
          id: row.id,
          studentId: row.studentId,
          studentName: row.studentName,
          classId: row.classId,
          className: row.className,
          subject: row.subject,
          examType: row.examType,
          term: row.term,
          sessionId: row.sessionId,
          components: row.components.map((component) => ({
            componentId: component.componentId,
            label: component.label,
            score: component.score,
            maxScore: component.maxScore,
          })),
          totalScore: row.totalScore,
          maxScore: row.maxScore,
          percentage: row.percentage,
        })),
      };

      const response = await postJSON<{ message?: string }>(
        "/api/results/scores",
        payload,
      );

      setDraftScores((prev) => {
        const next = { ...prev };
        rows.forEach((row) => delete next[row.id]);
        return next;
      });

      await loadClassData({
        classId: filters.classId,
        term: filters.term,
        sessionId: filters.sessionId,
      });

      return response?.message ?? "Scores saved successfully.";
    },
    [loadClassData],
  );

  const gradeForPercentage = useCallback(
    (score: number) => getGradeForScore(score),
    [],
  );

  const gradeForMidterm = useCallback(
    (scoreOutOf50: number) => getGradeForMidtermScore(scoreOutOf50),
    [],
  );

  const computeSummaries = useCallback(
    (filters: ClassFilters, examType: "midterm" | "final") => {
      const key = buildClassKey(filters);
      const records = classRecords[key];
      if (!records?.length) return [];

      const grouped = new Map<
        number,
        {
          studentId: number;
          studentName: string;
          classId: string;
          className: string;
          totalPercentage: number;
          subjectCount: number;
        }
      >();

      records.forEach((rawRecord) => {
        if (rawRecord.examType !== examType) return;
        if (rawRecord.term !== filters.term) return;
        if (rawRecord.sessionId !== filters.sessionId) return;

        const record = applyDraft(rawRecord);
        const percentage = Number.isFinite(record.percentage)
          ? record.percentage
          : record.maxScore
          ? (record.totalScore / record.maxScore) * 100
          : 0;

        const current = grouped.get(record.studentId);
        if (current) {
          current.totalPercentage += percentage;
          current.subjectCount += 1;
        } else {
          grouped.set(record.studentId, {
            studentId: record.studentId,
            studentName: record.studentName,
            classId: record.classId,
            className: record.className,
            totalPercentage: percentage,
            subjectCount: 1,
          });
        }
      });

      const summaries = Array.from(grouped.values()).map((entry) => {
        const average = entry.subjectCount
          ? entry.totalPercentage / entry.subjectCount
          : 0;
        const averageRounded = Math.round(average * 10) / 10;
        const grade = gradeForPercentage(averageRounded);

        return {
          id: `${entry.classId}-${entry.studentId}-${examType}`,
          studentId: entry.studentId,
          studentName: entry.studentName,
          classId: entry.classId,
          className: entry.className,
          averageScore: averageRounded,
          grade: grade.grade,
          remark: grade.remark,
          position: 0,
          sessionId: filters.sessionId,
          term: filters.term,
        } satisfies StudentResultSummary;
      });

      summaries.sort((a, b) => {
        if (b.averageScore !== a.averageScore) {
          return b.averageScore - a.averageScore;
        }
        return a.studentName.localeCompare(b.studentName);
      });

      let lastScore: number | null = null;
      let lastPosition = 0;
      let processed = 0;

      return summaries.map((summary) => {
        processed += 1;
        if (lastScore === null || summary.averageScore !== lastScore) {
          lastScore = summary.averageScore;
          lastPosition = processed;
        }
        return { ...summary, position: lastPosition };
      });
    },
    [applyDraft, classRecords, gradeForPercentage],
  );

  const getResultSummaries = useCallback(
    (filters: ClassFilters) => computeSummaries(filters, "final"),
    [computeSummaries],
  );

  const getMidtermSummaries = useCallback(
    (filters: ClassFilters) => computeSummaries(filters, "midterm"),
    [computeSummaries],
  );

  const getStudentDetails = useCallback(
    ({
      studentId,
      term,
      sessionId,
    }: {
      studentId: number;
      term: Term;
      sessionId: string;
    }) => {
      const allRecords = Object.values(classRecords).flat();
      const relevant = allRecords.filter(
        (record) =>
          record.studentId === studentId &&
          record.term === term &&
          record.sessionId === sessionId,
      );

      if (!relevant.length) {
        return { finals: [], midterm: [] };
      }

      const finals = relevant
        .filter((record) => record.examType === "final")
        .map(applyDraft)
        .sort((a, b) => a.subject.localeCompare(b.subject));

      const midterm = relevant
        .filter((record) => record.examType === "midterm")
        .map(applyDraft)
        .sort((a, b) => a.subject.localeCompare(b.subject));

      const classId = finals[0]?.classId ?? midterm[0]?.classId ?? "";

      const finalSummary = classId
        ? getResultSummaries({ classId, term, sessionId }).find(
            (summary) => summary.studentId === studentId,
          )
        : undefined;

      const midtermSummary = classId
        ? getMidtermSummaries({ classId, term, sessionId }).find(
            (summary) => summary.studentId === studentId,
          )
        : undefined;

      return {
        finals,
        midterm,
        finalSummary,
        midtermSummary,
      };
    },
    [applyDraft, classRecords, getMidtermSummaries, getResultSummaries],
  );

  const getPromotionCandidates = useCallback(
    (filters: ClassFilters) => {
      const summaries = getResultSummaries(filters);
      if (!summaries.length) return [];

      return summaries.map((summary) => {
        const key = studentDecisionKey(summary.classId, summary.studentId);
        const manualDecision = promotionDecisions[key];
        const autoPromoted = summary.averageScore >= PROMOTION_THRESHOLD;
        const decision = manualDecision ?? "auto";
        const promoted =
          manualDecision === "promote" ||
          (manualDecision == null && autoPromoted);

        return {
          id: `${summary.classId}-${summary.studentId}-promotion`,
          studentId: summary.studentId,
          studentName: summary.studentName,
          classId: summary.classId,
          className: summary.className,
          nextClassId: null,
          nextClassName: null,
          averageScore: summary.averageScore,
          grade: summary.grade,
          remark: summary.remark,
          autoPromoted,
          decision,
          promoted,
        } satisfies PromotionCandidate;
      });
    },
    [getResultSummaries, promotionDecisions],
  );

  const setPromotionDecision = useCallback(
    (classId: string, studentId: number, decision: "auto" | "promote" | "hold") => {
      setPromotionDecisions((prev) => {
        const key = studentDecisionKey(classId, studentId);
        if (decision === "auto") {
          if (!(key in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[key];
          return next;
        }

        return { ...prev, [key]: decision };
      });
    },
    [],
  );

  const finalizePromotion = useCallback(
    (filters: ClassFilters) => {
      const candidates = getPromotionCandidates(filters);
      const promoted = candidates.filter((candidate) => candidate.promoted);
      // TODO: persist promotion decisions once an API endpoint is available.
      console.info("[ResultsContext] Promotion decisions finalised", {
        filters,
        promotedCount: promoted.length,
      });
          return candidates;
    },
    [getPromotionCandidates],
  );

  const getLockInfo = useCallback(
    ({ classId, term, sessionId, examType }: ClassFilters & { examType: "midterm" | "final" }) => {
      const key = buildClassKey({ classId, term, sessionId });
      return classLocks[key]?.[examType] ?? null;
    },
    [classLocks],
  );

  const value = useMemo<ResultsContextValue>(
    () => ({
      classOptions,
      classOptionsLoading,
      classOptionsError,
      loadClassData,
      isClassLoading,
      getClassError,
      isClassLoaded,
      getSubjectsForClass,
      getScoreSheets,
      getScoreComponents,
      updateScore,
      saveScores,
      getResultSummaries,
      getMidtermSummaries,
      getAvailableExamTypes,
      getStudentDetails,
      gradeForPercentage,
      gradeForMidterm,
      promotionThreshold: PROMOTION_THRESHOLD,
      getPromotionCandidates,
      setPromotionDecision,
      finalizePromotion,
      markDistributionLoading,
      markDistributionError,
      getLockInfo,
      refreshMarkDistributions,
    }),
    [
      classOptions,
      classOptionsLoading,
      classOptionsError,
      loadClassData,
      isClassLoading,
      getClassError,
      isClassLoaded,
      getSubjectsForClass,
      getScoreSheets,
      getScoreComponents,
      updateScore,
      saveScores,
      getResultSummaries,
      getMidtermSummaries,
      getAvailableExamTypes,
      getStudentDetails,
      gradeForPercentage,
      gradeForMidterm,
      getPromotionCandidates,
      setPromotionDecision,
      finalizePromotion,
      markDistributionLoading,
      markDistributionError,
      getLockInfo,
      refreshMarkDistributions,
    ],
  );

  return (
    <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>
  );
};

export const useResults = () => {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error("useResults must be used within a ResultsProvider");
  }
  return context;
};

export default ResultsProvider;

















