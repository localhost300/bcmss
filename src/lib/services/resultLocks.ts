import { ExamType, Prisma, ResultLock, Term } from "@prisma/client";

import prisma from "@/lib/prisma";

const TERM_LABEL_BY_ENUM: Record<Term, string> = {
  FIRST: "First Term",
  SECOND: "Second Term",
  THIRD: "Third Term",
};

const ENUM_BY_TERM_LABEL = new Map<string, Term>(
  Object.entries(TERM_LABEL_BY_ENUM).map(([enumKey, label]) => [
    label.toLowerCase(),
    enumKey as Term,
  ]),
);

const ENUM_BY_TERM_ALIAS = new Map<string, Term>([
  ["first", "FIRST"],
  ["second", "SECOND"],
  ["third", "THIRD"],
].map(([alias, term]) => [alias, term as Term]));

type ResultLockKey = {
  classId: number;
  sessionId: string;
  term: Term;
  examType: ExamType;
};

const toUniqueWhere = (key: ResultLockKey): Prisma.ResultLockWhereUniqueInput => ({
  classId_sessionId_term_examType: key,
});

const toJsonArray = (values: number[]): Prisma.JsonArray =>
  values.map((value) => Number(value)) as Prisma.JsonArray;

export const termLabelToEnum = (value: string | null | undefined): Term | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = ENUM_BY_TERM_LABEL.get(trimmed.toLowerCase());
  if (direct) return direct;
  const alias = ENUM_BY_TERM_ALIAS.get(trimmed.toLowerCase());
  return alias ?? null;
};

export const termEnumToLabel = (value: Term): string => TERM_LABEL_BY_ENUM[value];

export const examTypeLabelToEnum = (value: string | null | undefined): ExamType | null => {
  if (!value) return null;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return null;
  if (normalised === "midterm") return "MIDTERM";
  if (normalised === "final") return "FINAL";
  return null;
};

export const examTypeEnumToLabel = (value: ExamType): "midterm" | "final" =>
  value === "MIDTERM" ? "midterm" : "final";

export const toNumberArray = (value: Prisma.JsonValue | null | undefined): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "number" && Number.isFinite(entry)) {
        return entry;
      }
      if (typeof entry === "string" && entry.trim() !== "") {
        const parsed = Number.parseInt(entry.trim(), 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((entry): entry is number => entry != null);
};

export type ResultLockSummary = {
  id: number;
  classId: number;
  sessionId: string;
  term: string;
  examType: "midterm" | "final";
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  allowedTeacherIds: number[];
  notes: string | null;
};

export const summariseResultLock = (lock: ResultLock): ResultLockSummary => ({
  id: lock.id,
  classId: lock.classId,
  sessionId: lock.sessionId,
  term: termEnumToLabel(lock.term),
  examType: examTypeEnumToLabel(lock.examType),
  isLocked: lock.isLocked,
  lockedBy: lock.lockedBy ?? null,
  lockedAt: lock.lockedAt ? lock.lockedAt.toISOString() : null,
  allowedTeacherIds: toNumberArray(lock.allowedTeacherIds),
  notes: lock.notes ?? null,
});

export const listResultLocks = async (
  filters: Partial<ResultLockKey> & { classId?: number; sessionId?: string },
): Promise<ResultLock[]> => {
  const where: Prisma.ResultLockWhereInput = {};

  if (typeof filters.classId === "number" && Number.isFinite(filters.classId)) {
    where.classId = filters.classId;
  }
  if (typeof filters.sessionId === "string" && filters.sessionId.trim()) {
    where.sessionId = filters.sessionId.trim();
  }
  if (filters.term) {
    where.term = filters.term;
  }
  if (filters.examType) {
    where.examType = filters.examType;
  }

  return prisma.resultLock.findMany({ where });
};

export const findResultLocksByKeys = async (keys: ResultLockKey[]): Promise<ResultLock[]> => {
  if (!keys.length) {
    return [];
  }

  return prisma.resultLock.findMany({
    where: {
      OR: keys.map((key) => ({
        classId: key.classId,
        sessionId: key.sessionId,
        term: key.term,
        examType: key.examType,
      })),
    },
  });
};

const ensureResultLock = async (key: ResultLockKey): Promise<ResultLock> =>
  prisma.resultLock.upsert({
    where: toUniqueWhere(key),
    create: {
      ...key,
      isLocked: false,
      allowedTeacherIds: toJsonArray([]),
      notes: null,
    },
    update: {},
  });

export const setResultLockStatus = async (
  key: ResultLockKey,
  options: {
    isLocked: boolean;
    lockedBy?: string | null;
    notes?: string | null;
  },
): Promise<ResultLock> => {
  await ensureResultLock(key);
  const { isLocked, lockedBy, notes } = options;
  const lockedAt = isLocked ? new Date() : null;
  const data: Prisma.ResultLockUpdateInput = {
    isLocked,
    lockedBy: isLocked ? lockedBy ?? null : null,
    lockedAt,
    ...(isLocked ? {} : { allowedTeacherIds: toJsonArray([]) }),
  };
  if (notes !== undefined) {
    data.notes = notes;
  }
  return prisma.resultLock.update({
    where: toUniqueWhere(key),
    data,
  });
};

export const grantTeacherOverride = async (
  key: ResultLockKey,
  teacherId: number,
): Promise<ResultLock> => {
  if (!Number.isFinite(teacherId) || teacherId <= 0) {
    throw new Error("Invalid teacher id supplied.");
  }

  const lock = await ensureResultLock(key);
  const existing = new Set<number>(toNumberArray(lock.allowedTeacherIds));
  existing.add(teacherId);
  return prisma.resultLock.update({
    where: toUniqueWhere(key),
    data: {
      allowedTeacherIds: toJsonArray(Array.from(existing.values())),
    },
  });
};

export const revokeTeacherOverride = async (
  key: ResultLockKey,
  teacherId: number,
): Promise<ResultLock> => {
  if (!Number.isFinite(teacherId) || teacherId <= 0) {
    throw new Error("Invalid teacher id supplied.");
  }

  const lock = await ensureResultLock(key);
  const filtered = toNumberArray(lock.allowedTeacherIds).filter((id) => id !== teacherId);
  return prisma.resultLock.update({
    where: toUniqueWhere(key),
    data: {
      allowedTeacherIds: toJsonArray(filtered),
    },
  });
};

export { type ResultLockKey };
