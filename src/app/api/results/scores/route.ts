import { NextRequest, NextResponse } from "next/server";
import { Prisma, StudentScoreRecord } from "@prisma/client";

import prisma from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/auth/permissions";

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
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const where: Prisma.StudentScoreRecordWhereInput = {};

    const classId = params.get("classId");
    const subject = params.get("subject");
    const examType = params.get("examType");
    const term = params.get("term");
    const sessionId = params.get("sessionId");

    if (classId) where.classId = classId;
    if (subject) where.subject = subject;
    if (examType) where.examType = examType;
    if (term) where.term = term;
    if (sessionId) where.sessionId = sessionId;

    if (actor.isTeacher) {
      if (actor.allowedClassIds.size === 0) {
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
        where.classId = { in: Array.from(actor.allowedClassIds) };
      }

      if (subject) {
        const key = normaliseSubject(subject);
        if (key && actor.allowedSubjectNames.size > 0 && !actor.allowedSubjectNames.has(key)) {
          return NextResponse.json(
            { message: "You are not allowed to view scores for this subject." },
            { status: 403 },
          );
        }
      }
    }

    const records = await prisma.studentScoreRecord.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    const filtered = actor.isTeacher
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

    return NextResponse.json({ data: filtered.map(mapRecord) });
  } catch (error) {
    console.error("[Results API] Failed to load scores", error);
    return NextResponse.json({ message: "Unable to load scores." }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (actor.isTeacher && actor.teacherId == null) {
      return NextResponse.json(
        { message: "Teacher profile is not configured for this account." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as SaveScoresBody | null;
    if (!body?.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ message: "No score rows provided." }, { status: 400 });
    }

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
    }

    if (actor.isTeacher) {
      if (actor.allowedClassIds.size === 0 || actor.allowedSubjectNames.size === 0) {
        return NextResponse.json(
          { message: "You are not allowed to upload scores yet. Contact an administrator." },
          { status: 403 },
        );
      }

      for (const row of body.rows) {
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
    }

    const results: PersistedScoreRecord[] = [];
    for (const row of body.rows) {
      const components = normalizeComponents(row.components);
      const totalScore = coerceNumber(row.totalScore);
      const maxScore = coerceNumber(row.maxScore);
      const percentage = coerceNumber(row.percentage);

      const persisted = await prisma.studentScoreRecord.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          studentId: row.studentId,
          studentName: row.studentName,
          classId: row.classId,
          className: row.className,
          subject: row.subject,
          examType: row.examType,
          term: row.term,
          sessionId: row.sessionId,
          components: serializeComponents(components),
          totalScore,
          maxScore,
          percentage,
        },
        update: {
          studentId: row.studentId,
          studentName: row.studentName,
          classId: row.classId,
          className: row.className,
          subject: row.subject,
          examType: row.examType,
          term: row.term,
          sessionId: row.sessionId,
          components: serializeComponents(components),
          totalScore,
          maxScore,
          percentage,
        },
      });

      results.push(persisted);
    }

    return NextResponse.json({ message: "Scores saved successfully.", data: results.map(mapRecord) });
  } catch (error) {
    console.error("[Results API] Failed to save scores", error);
    return NextResponse.json({ message: "Unable to save scores." }, { status: 500 });
  }
}

