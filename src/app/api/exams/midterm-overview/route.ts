import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MIDTERM_COMPONENT_IDS = new Set([
  "ca1",
  "classparticipation",
  "quiz",
  "assignment",
]);

const parseComponents = (
  value: Prisma.JsonValue,
): Array<{ id: string; label: string; score: number; maxScore: number | null }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry, index) => {
    const record = entry as Record<string, unknown>;

    const rawId = record.componentId;
    const rawLabel = record.label;
    const idCandidate =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : typeof rawId === "number" && Number.isFinite(rawId)
        ? `component-${rawId}`
        : typeof rawLabel === "string" && rawLabel.trim().length > 0
        ? rawLabel.trim()
        : `component-${index}`;

    const label =
      typeof rawLabel === "string" && rawLabel.trim().length > 0 ? rawLabel.trim() : idCandidate;

    const rawScore = record.score;
    const score = typeof rawScore === "number" && Number.isFinite(rawScore) ? rawScore : 0;

    const rawMax = record.maxScore;
    const maxScore = typeof rawMax === "number" && Number.isFinite(rawMax) ? rawMax : null;

    return { id: idCandidate, label, score, maxScore };
  });
};

const sumScores = (components: Array<{ score: number }>) =>
  components.reduce((total, component) => total + component.score, 0);

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const sessionId = params.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ message: "sessionId is required." }, { status: 400 });
  }

  const termFilter = params.get("term") ?? undefined;
  const classFilter = params.get("classId") ?? undefined;
  const subjectFilter = params.get("subject") ?? undefined;

  const where: Prisma.StudentScoreRecordWhereInput = {
    sessionId,
    examType: "final",
  };

  if (termFilter) {
    where.term = termFilter;
  }
  if (classFilter) {
    where.classId = classFilter;
  }
  if (subjectFilter) {
    where.subject = subjectFilter;
  }

  try {
    const records = await prisma.studentScoreRecord.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        studentName: true,
        classId: true,
        className: true,
        subject: true,
        components: true,
        totalScore: true,
        percentage: true,
      },
    });

    if (!records.length) {
      return NextResponse.json({ items: [] });
    }

    const items = records.map((record) => {
      const components = parseComponents(record.components);

      const midtermComponents = components.filter((component) =>
        MIDTERM_COMPONENT_IDS.has(component.id.trim().toLowerCase()),
      );

      const midtermScore = roundToOneDecimal(sumScores(midtermComponents));
      const finalTotal = roundToOneDecimal(
        record.totalScore != null ? Number(record.totalScore) : sumScores(components),
      );

      return {
        id: record.id,
        studentId: record.studentId,
        studentName: record.studentName,
        subject: record.subject,
        classId: record.classId,
        className: record.className,
        midtermScore,
        finalTotal,
        percentage: record.percentage ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("[MidtermOverview API] Failed to load midterm overview", error);
    return NextResponse.json({ message: "Unable to load midterm overview." }, { status: 500 });
  }
}

