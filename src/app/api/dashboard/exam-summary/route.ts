import { NextRequest, NextResponse } from "next/server";
import { Prisma, Term } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  schoolId: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional(),
  sessionId: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional(),
  term: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional(),
});

const TERM_LABELS: Record<Term, string> = {
  [Term.FIRST]: "First Term",
  [Term.SECOND]: "Second Term",
  [Term.THIRD]: "Third Term",
};

const normaliseTerm = (
  raw?: string,
): { enum?: Term; label?: string } => {
  if (!raw) {
    return {};
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const upper = trimmed.toUpperCase();
  if (upper in Term) {
    const termEnum = Term[upper as keyof typeof Term];
    return { enum: termEnum, label: TERM_LABELS[termEnum] };
  }

  const simplified = trimmed.replace(/\s+/g, "").toLowerCase();
  if (simplified === "firstterm" || simplified === "first") {
    return { enum: Term.FIRST, label: TERM_LABELS[Term.FIRST] };
  }
  if (simplified === "secondterm" || simplified === "second") {
    return { enum: Term.SECOND, label: TERM_LABELS[Term.SECOND] };
  }
  if (simplified === "thirdterm" || simplified === "third") {
    return { enum: Term.THIRD, label: TERM_LABELS[Term.THIRD] };
  }

  return { label: trimmed };
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { schoolId, sessionId, term } = parsed.data;
    const { enum: termEnum, label: termLabel } = normaliseTerm(term);

    const examWhere: Prisma.ExamWhereInput = {};
    if (schoolId) examWhere.schoolId = schoolId;
    if (sessionId) examWhere.sessionId = sessionId;
    if (termEnum) examWhere.term = termEnum;

    const distributionWhere: Prisma.MarkDistributionWhereInput = {};
    if (schoolId) distributionWhere.schoolId = schoolId;
    if (sessionId) distributionWhere.sessionId = sessionId;
    if (termEnum) distributionWhere.term = termEnum;

    const classIdFilter =
      schoolId
        ? await prisma.schoolClass.findMany({
            where: { schoolId },
            select: { id: true },
          })
        : null;

    const midtermWhere: Prisma.StudentScoreRecordWhereInput = { examType: "midterm" };
    if (sessionId) midtermWhere.sessionId = sessionId;
    if (termLabel) midtermWhere.term = termLabel;
    if (classIdFilter?.length) {
      midtermWhere.classId = {
        in: classIdFilter.map((entry) => String(entry.id)),
      };
    } else if (schoolId) {
      // No classes for this school means no midterm records match the filter.
      midtermWhere.classId = { in: [] };
    }

    const [scheduledCount, distributionCount, midtermCount] = await Promise.all([
      prisma.exam.count({ where: examWhere }),
      prisma.markDistribution.count({ where: distributionWhere }),
      prisma.studentScoreRecord.count({ where: midtermWhere }),
    ]);

    return NextResponse.json({
      data: {
        scheduledCount,
        distributionCount,
        midtermCount,
      },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.warn(
        "[DashboardExamSummary] Database unavailable, returning zeroed stats",
        error,
      );
      return NextResponse.json({
        data: {
          scheduledCount: 0,
          distributionCount: 0,
          midtermCount: 0,
        },
      });
    }

    console.error("[DashboardExamSummary] Failed to load data", error);
    return NextResponse.json(
      { message: "Unable to load exam summaries." },
      { status: 500 },
    );
  }
}
