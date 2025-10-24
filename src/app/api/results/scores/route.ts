import { NextRequest, NextResponse } from "next/server";
import { ExamType, Prisma, ResultLock, StudentScoreRecord, Term } from "@prisma/client";

import prisma from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/auth/permissions";
import {
  examTypeEnumToLabel,
  examTypeLabelToEnum,
  findResultLocksByKeys,
  listResultLocks,
  ResultLockKey,
  ResultLockSummary,
  termEnumToLabel,
  termLabelToEnum,
  toNumberArray,
  summariseResultLock,
} from "@/lib/services/resultLocks";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type ScoreComponentPayload = {
  componentId: string;
  label?: string;
  score?: number;
  maxScore?: number;
};
type SaveScoreRowPayload = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  subject: string;
  examType: string;
  term: string;
  sessionId: string;
  components: ScoreComponentPayload[];
  totalScore?: number;
  maxScore?: number;
  percentage?: number;
};
type SaveScoresBody = {
  filters?: Record<string, unknown>;
  rows?: SaveScoreRowPayload[];
};

type PersistedScoreRecord = StudentScoreRecord;

type NormalizedComponent = {
  componentId: string;
  label: string;
  score: number;
  maxScore: number | null;
};

type PreparedScoreRow = {
  row: SaveScoreRowPayload;
  components: NormalizedComponent[];
  totalScore: number | null;
  maxScore: number | null;
  percentage: number | null;
};

// Limit results aggressively so reads stay under the 10s Vercel timeout even with large tables.
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
// Batch writes to avoid hammering the database when we schedule background persistence later on.
const UPSERT_BATCH_SIZE = 20;
// Cap the number of background warm-up calls so we do not overload the serverless function after responding.
const MAX_BACKGROUND_WARMUPS = 5;

// Lightweight timer helper so we can log duration for each major step in vercel dev/logs.
const createTimer = (label: string) => {
  const startedAt = Date.now();
  return () => {
    const elapsed = Date.now() - startedAt;
    console.log(`[Results Scores] ${label} completed in ${elapsed}ms`);
  };
};

// Parse page size/limit parameters defensively to keep load-shaping logic tight.
const parseLimit = (raw: string | null) => {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

// Simple queue helper so we can batch work without allocating new arrays on each iteration.
const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const isFulfilledResult = <T>(
  result: PromiseSettledResult<T>,
): result is PromiseFulfilledResult<T> => result.status === "fulfilled";

// Fallback background scheduler for environments without `unstable_after`.
const scheduleBackgroundWork = (task: () => Promise<void> | void) => {
  setTimeout(() => {
    Promise.resolve(task()).catch((error) => {
      console.error("[Results Scores] Background task failed", error);
    });
  }, 0);
};
const isString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const normaliseSubject = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

type SerializedLock = ResultLockSummary;

const LOCK_KEY_SEPARATOR = "::";

const buildLockKey = (
  classId: string | number,
  sessionId: string,
  term: string,
  examType: string,
) => [String(classId), sessionId, term, examType].join(LOCK_KEY_SEPARATOR);

const buildEnumLockKey = (key: ResultLockKey) =>
  [key.classId, key.sessionId, key.term, key.examType].join(LOCK_KEY_SEPARATOR);

const parseClassIdParam = (value: string | number | null | undefined): number | null => {
  if (value == null) return null;
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const createLockMap = (locks: SerializedLock[]) => {
  const map = new Map<string, SerializedLock>();
  locks.forEach((lock) => {
    const key = buildLockKey(lock.classId, lock.sessionId, lock.term, lock.examType);
    map.set(key, lock);
  });
  return map;
};
const normalizeComponents = (components: ScoreComponentPayload[] | undefined): NormalizedComponent[] => {
  if (!Array.isArray(components)) {
    return [];
  }

  return components
    .filter((component): component is ScoreComponentPayload => Boolean(component?.componentId))
    .map((component) => {
      const score = coerceNumber(component.score) ?? 0;
      const maxScore = coerceNumber(component.maxScore);
      return {
        componentId: component.componentId,
        label: component.label ?? component.componentId,
        score,
        maxScore,
      } satisfies NormalizedComponent;
    });
};
const serializeComponents = (components: NormalizedComponent[]): Prisma.InputJsonValue => {
  return components.map((component) => ({
    componentId: component.componentId,
    label: component.label,
    score: component.score,
    maxScore: component.maxScore,
  }));
};

// Persist rows in bounded batches so that we parallelise writes without exceeding the function timeout.
const persistScoreChunks = async (rows: PreparedScoreRow[]): Promise<PersistedScoreRecord[]> => {
  if (!rows.length) {
    return [];
  }

  const persisted: PersistedScoreRecord[] = [];
  const chunks = chunkArray(rows, UPSERT_BATCH_SIZE);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    console.log(
      `[Results Scores] POST persisting chunk ${index + 1}/${chunks.length} (${chunk.length} rows)`,
    );
    const stopChunkTimer = createTimer(`POST chunk ${index + 1}`);

    const chunkResult = await prisma.$transaction(
      async (tx) => {
        const writes = chunk.map((entry) =>
          tx.studentScoreRecord.upsert({
            where: { id: entry.row.id },
            create: {
              id: entry.row.id,
              studentId: entry.row.studentId,
              studentName: entry.row.studentName,
              classId: entry.row.classId,
              className: entry.row.className,
              subject: entry.row.subject,
              examType: entry.row.examType,
              term: entry.row.term,
              sessionId: entry.row.sessionId,
              components: serializeComponents(entry.components),
              totalScore: entry.totalScore,
              maxScore: entry.maxScore,
              percentage: entry.percentage,
            },
            update: {
              studentId: entry.row.studentId,
              studentName: entry.row.studentName,
              classId: entry.row.classId,
              className: entry.row.className,
              subject: entry.row.subject,
              examType: entry.row.examType,
              term: entry.row.term,
              sessionId: entry.row.sessionId,
              components: serializeComponents(entry.components),
              totalScore: entry.totalScore,
              maxScore: entry.maxScore,
              percentage: entry.percentage,
            },
          }),
        );

        const settled = await Promise.allSettled(writes);
        const failures = settled.filter((result) => result.status === "rejected");
        if (failures.length) {
          failures.forEach((failure) => {
            console.error("[Results Scores] Failed score row upsert", failure.reason);
          });
          throw failures[0].reason ?? new Error("Failed to persist score rows.");
        }

        return settled.filter(isFulfilledResult).map((result) => result.value);
      },
      {
        maxWait: 5_000,
        timeout: 8_000,
      },
    );

    stopChunkTimer();
    persisted.push(...chunkResult);
  }

  return persisted;
};

const mapRecord = (record: PersistedScoreRecord) => ({
  id: record.id,
  studentId: record.studentId,
  studentName: record.studentName,
  classId: record.classId,
  className: record.className,
  subject: record.subject,
  examType: record.examType,
  term: record.term,
  sessionId: record.sessionId,
  components: record.components,
  totalScore: record.totalScore,
  maxScore: record.maxScore,
  percentage: record.percentage,
  updatedAt: record.updatedAt,
});
export async function GET(request: NextRequest) {
  const logTotal = createTimer("GET total");
  try {
    console.log(`[Results Scores] GET ${request.nextUrl.pathname}${request.nextUrl.search}`);

    // Kick off auth lookup while we parse query params so the I/O overlaps.
    const actorPromise = resolveRequestActor();
    const params = request.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const filters: Prisma.StudentScoreRecordWhereInput[] = [];

    const classId = params.get("classId");
    const subjectParam = params.get("subject");
    const examType = params.get("examType");
    const term = params.get("term");
    const sessionId = params.get("sessionId");

    if (classId) {
      filters.push({ classId });
    }
    if (subjectParam) {
      filters.push({ subject: { equals: subjectParam, mode: "insensitive" } });
    }
    if (examType) {
      filters.push({ examType });
    }
    if (term) {
      filters.push({ term });
    }
    if (sessionId) {
      filters.push({ sessionId });
    }

    const actor = await actorPromise;
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    if (actor.isTeacher) {
      if (actor.allowedClassIds.size === 0) {
        console.warn("[Results Scores] Teacher has no allowed classes; returning empty set.");
        return NextResponse.json({ data: [] });
      }

      if (classId) {
        if (!actor.allowedClassIds.has(classId)) {
          return NextResponse.json(
            { message: "You are not allowed to view scores for this class." },
            { status: 403 },
          );
        }
      } else {
        filters.push({ classId: { in: Array.from(actor.allowedClassIds) } });
      }

      if (subjectParam) {
        const key = normaliseSubject(subjectParam);
        if (key && actor.allowedSubjectNames.size > 0 && !actor.allowedSubjectNames.has(key)) {
          return NextResponse.json(
            { message: "You are not allowed to view scores for this subject." },
            { status: 403 },
          );
        }
      } else if (actor.allowedSubjectNames.size > 0) {
        filters.push({
          OR: Array.from(actor.allowedSubjectNames).map((name) => ({
            subject: { equals: name, mode: "insensitive" as const },
          })),
        });
      }
    }

    const where =
      filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { AND: filters };

    // Time the heavy prisma call so slow queries stand out in logs.
    const stopDbTimer = createTimer("GET prisma.studentScoreRecord.findMany");
    const records = await prisma.studentScoreRecord.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    });
    stopDbTimer();
    console.log(`[Results Scores] GET returning ${records.length} rows (limit=${limit}).`);

    const classIdNumber = parseClassIdParam(classId);
    const requestedTermEnum = termLabelToEnum(term);
    const requestedExamTypeEnum = examTypeLabelToEnum(examType);

    let lockRecords: ResultLock[] = [];

    if (classIdNumber && sessionId) {
      lockRecords = await listResultLocks({
        classId: classIdNumber,
        sessionId,
        ...(requestedTermEnum ? { term: requestedTermEnum } : {}),
        ...(requestedExamTypeEnum ? { examType: requestedExamTypeEnum } : {}),
      });
    }

    if (lockRecords.length === 0) {
      const derivedKeys = new Map<string, ResultLockKey>();
      records.forEach((record) => {
        const derivedClassId = parseClassIdParam(record.classId);
        const derivedTermEnum = termLabelToEnum(record.term);
        const derivedExamTypeEnum = examTypeLabelToEnum(record.examType);
        if (
          derivedClassId &&
          derivedTermEnum &&
          derivedExamTypeEnum
        ) {
          const key: ResultLockKey = {
            classId: derivedClassId,
            sessionId: record.sessionId,
            term: derivedTermEnum,
            examType: derivedExamTypeEnum,
          };
          const uniqueKey = buildEnumLockKey(key);
          if (!derivedKeys.has(uniqueKey)) {
            derivedKeys.set(uniqueKey, key);
          }
        }
      });
      if (derivedKeys.size) {
        lockRecords = await findResultLocksByKeys(Array.from(derivedKeys.values()));
      }
    }

    const serializedLocks = lockRecords.map(summariseResultLock);
    const lockMap = createLockMap(serializedLocks);

    const teacherFiltered = actor.isTeacher
      ? records.filter((record) => {
          if (!actor.allowedClassIds.has(record.classId)) {
            return false;
          }
          if (actor.allowedSubjectNames.size === 0) {
            return true;
          }
          const subjectKey = normaliseSubject(record.subject);
          return subjectKey ? actor.allowedSubjectNames.has(subjectKey) : false;
        })
      : records;

    const viewerIsParentOrStudent = actor.role === "parent" || actor.role === "student";
    const visibleRecords = viewerIsParentOrStudent
      ? teacherFiltered.filter((record) => {
          const key = buildLockKey(record.classId, record.sessionId, record.term, record.examType);
          const lock = lockMap.get(key);
          return Boolean(lock?.isLocked);
        })
      : teacherFiltered;

    return NextResponse.json({ data: visibleRecords.map(mapRecord), locks: serializedLocks });
  } catch (error) {
    console.error("[Results API] Failed to load scores", error);
    return NextResponse.json({ message: "Unable to load scores." }, { status: 500 });
  } finally {
    logTotal();
  }
}
export async function POST(request: NextRequest) {
  const logTotal = createTimer("POST total");
  try {
    console.log("[Results Scores] POST request received.");

    const origin = request.nextUrl.origin;
    // Start auth resolution and JSON parsing together to trim overall latency.
    const actorPromise = resolveRequestActor();
    const bodyPromise = request
      .json()
      .catch((error) => {
        console.error("[Results Scores] Invalid JSON payload.", error);
        throw new Error("INVALID_JSON");
      }) as Promise<SaveScoresBody | null>;

    const actor = await actorPromise;
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (actor.isTeacher && actor.teacherId == null) {
      return NextResponse.json(
        { message: "Teacher profile is not configured for this account." },
        { status: 403 },
      );
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "You are not allowed to upload scores." },
        { status: 403 },
      );
    }

    let body: SaveScoresBody | null = null;
    try {
      body = await bodyPromise;
    } catch (parseError) {
      if ((parseError as Error)?.message === "INVALID_JSON") {
        return NextResponse.json({ message: "Request body is not valid JSON." }, { status: 400 });
      }
      throw parseError;
    }

    if (!body?.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ message: "No score rows provided." }, { status: 400 });
    }

    if (actor.isTeacher) {
      if (actor.allowedClassIds.size === 0 || actor.allowedSubjectNames.size === 0) {
        return NextResponse.json(
          { message: "You are not allowed to upload scores yet. Contact an administrator." },
          { status: 403 },
        );
      }
    }

    console.log(`[Results Scores] POST validating ${body.rows.length} rows.`);
    const preparedRows: PreparedScoreRow[] = [];
    const lockMetadata: Array<{
      row: SaveScoreRowPayload;
      classId: number;
      termEnum: Term;
      examTypeEnum: ExamType;
    }> = [];

    for (const row of body.rows) {
      if (!isString(row.id)) {
        return NextResponse.json({ message: "Score row is missing an id." }, { status: 400 });
      }
      if (typeof row.studentId !== "number" || Number.isNaN(row.studentId)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing a valid studentId.` }, { status: 400 });
      }
      if (!isString(row.studentName)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing a studentName.` }, { status: 400 });
      }
      if (!isString(row.classId) || !isString(row.className)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing class identifiers.` }, { status: 400 });
      }
      if (!isString(row.subject)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing a subject.` }, { status: 400 });
      }
      if (!isString(row.examType)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing an exam type.` }, { status: 400 });
      }
      if (!isString(row.term)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing a term.` }, { status: 400 });
      }
      if (!isString(row.sessionId)) {
        return NextResponse.json({ message: `Score row ${row.id} is missing a sessionId.` }, { status: 400 });
      }

      const numericClassId = parseClassIdParam(row.classId);
      if (!numericClassId || numericClassId <= 0) {
        return NextResponse.json(
          { message: `Score row ${row.id} is missing a valid class identifier.` },
          { status: 400 },
        );
      }

      const termEnum = termLabelToEnum(row.term);
      if (!termEnum) {
        return NextResponse.json(
          { message: `Score row ${row.id} is missing a recognised term.` },
          { status: 400 },
        );
      }

      const examTypeEnum = examTypeLabelToEnum(row.examType);
      if (!examTypeEnum) {
        return NextResponse.json(
          { message: `Score row ${row.id} is missing a recognised exam type.` },
          { status: 400 },
        );
      }

      if (actor.isTeacher) {
        if (!actor.allowedClassIds.has(row.classId)) {
          return NextResponse.json(
            { message: `You are not allowed to upload scores for class ${row.className}.` },
            { status: 403 },
          );
        }
        const subjectKey = normaliseSubject(row.subject);
        if (!subjectKey || !actor.allowedSubjectNames.has(subjectKey)) {
          return NextResponse.json(
            { message: `You are not allowed to upload scores for subject ${row.subject}.` },
            { status: 403 },
          );
        }
      }

      lockMetadata.push({
        row,
        classId: numericClassId,
        termEnum,
        examTypeEnum,
      });

      preparedRows.push({
        row,
        components: normalizeComponents(row.components),
        totalScore: coerceNumber(row.totalScore),
        maxScore: coerceNumber(row.maxScore),
        percentage: coerceNumber(row.percentage),
      });
    }

    const lockKeyMap = new Map<string, ResultLockKey>();
    lockMetadata.forEach(({ row, classId, termEnum, examTypeEnum }) => {
      const key: ResultLockKey = {
        classId,
        sessionId: row.sessionId,
        term: termEnum,
        examType: examTypeEnum,
      };
      lockKeyMap.set(buildEnumLockKey(key), key);
    });

    let existingLocks: ResultLock[] = [];
    if (lockKeyMap.size) {
      existingLocks = await findResultLocksByKeys(Array.from(lockKeyMap.values()));
    }

    const lockLookup = new Map<
      string,
      { lock: ResultLock; allowed: Set<number> }
    >();
    existingLocks.forEach((lock) => {
      const key = buildEnumLockKey({
        classId: lock.classId,
        sessionId: lock.sessionId,
        term: lock.term,
        examType: lock.examType,
      });
      lockLookup.set(key, {
        lock,
        allowed: new Set(toNumberArray(lock.allowedTeacherIds)),
      });
    });

    if (!actor.isAdmin) {
      const teacherId = actor.teacherId ?? null;
      for (const meta of lockMetadata) {
        const key = buildEnumLockKey({
          classId: meta.classId,
          sessionId: meta.row.sessionId,
          term: meta.termEnum,
          examType: meta.examTypeEnum,
        });
        const info = lockLookup.get(key);
        if (info?.lock.isLocked) {
          if (actor.isTeacher && teacherId != null && info.allowed.has(teacherId)) {
            continue;
          }
          return NextResponse.json(
            {
              message: `Scores for ${meta.row.className} (${meta.row.examType}) are locked. Contact an administrator to request changes.`,
            },
            { status: 403 },
          );
        }
      }
    }

    const stopPersistTimer = createTimer("POST persist batches");
    const persisted = await persistScoreChunks(preparedRows);
    stopPersistTimer();
    console.log(`[Results Scores] POST persisted ${persisted.length} rows.`);

    const warmTargets = new Set<string>();
    preparedRows.forEach(({ row }) => {
      warmTargets.add(`${row.classId}::${row.sessionId}::${row.term ?? ""}`);
    });

    const warmableTargets = Array.from(warmTargets).slice(0, MAX_BACKGROUND_WARMUPS);
    if (warmableTargets.length) {
      // Warm related GET requests in the background so follow-up fetches hit hot data without blocking this response.
      scheduleBackgroundWork(async () => {
        const stopWarmTimer = createTimer("POST background warmups");
        await Promise.all(
          warmableTargets.map(async (target) => {
            const [classIdValue, sessionIdValue, termValue] = target.split("::");
            const params = new URLSearchParams();
            params.set("classId", classIdValue);
            params.set("sessionId", sessionIdValue);
            if (termValue) {
              params.set("term", termValue);
            }

            const warmUrl = `${origin}/api/results/scores?${params.toString()}`;
            const controller = new AbortController();
            const timeoutHandle = setTimeout(() => controller.abort(), 5_000);

            try {
              const response = await fetch(warmUrl, {
                method: "GET",
                cache: "no-store",
                signal: controller.signal,
              });
              if (!response.ok) {
                console.warn(
                  `[Results Scores] Warmup request returned ${response.status} for ${warmUrl}`,
                );
              }
            } catch (warmError) {
              console.error("[Results Scores] Warmup fetch failed", warmError);
            } finally {
              clearTimeout(timeoutHandle);
            }
          }),
        );
        stopWarmTimer();
      });
    }

    return NextResponse.json({ message: "Scores saved successfully.", data: persisted.map(mapRecord) });
  } catch (error) {
    console.error("[Results API] Failed to save scores", error);
    return NextResponse.json({ message: "Unable to save scores." }, { status: 500 });
  } finally {
    logTotal();
  }
}
