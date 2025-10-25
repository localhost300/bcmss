import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TERM_SEQUENCE = ["First Term", "Second Term", "Third Term"] as const;
const TERM_ALIAS_MAP: Record<string, (typeof TERM_SEQUENCE)[number]> = {
  firstterm: "First Term",
  first: "First Term",
  "first term": "First Term",
  secondterm: "Second Term",
  second: "Second Term",
  "second term": "Second Term",
  thirdterm: "Third Term",
  third: "Third Term",
  "third term": "Third Term",
};

const querySchema = z.object({
  schoolId: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  term: z.string().trim().optional(),
  examType: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
});

const normaliseExamType = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const simplified = value.trim().toLowerCase();
  if (!simplified) return undefined;
  if (simplified === "midterm" || simplified === "mid-term") return "midterm";
  if (simplified === "final" || simplified === "finals") return "final";
  return value.trim();
};

const normaliseTermLabel = (value?: string | null): (typeof TERM_SEQUENCE)[number] | undefined => {
  if (!value) return undefined;
  const simplified = value.trim().toLowerCase();
  if (!simplified) return undefined;
  if (simplified in TERM_ALIAS_MAP) {
    return TERM_ALIAS_MAP[simplified];
  }
  if (TERM_SEQUENCE.includes(value as (typeof TERM_SEQUENCE)[number])) {
    return value as (typeof TERM_SEQUENCE)[number];
  }
  return undefined;
};

const buildTermKey = (value?: string | null): string | undefined => {
  const normalised = normaliseTermLabel(value);
  return normalised ?? value?.trim();
};

const normalisePercentage = (record: {
  percentage: number | null;
  totalScore: number | null;
  maxScore: number | null;
}): number | null => {
  if (record.percentage !== null && Number.isFinite(record.percentage)) {
    return record.percentage;
  }
  if (
    record.totalScore !== null &&
    record.maxScore !== null &&
    Number.isFinite(record.totalScore) &&
    Number.isFinite(record.maxScore) &&
    record.maxScore !== 0
  ) {
    const derived = (record.totalScore / record.maxScore) * 100;
    return Number.isFinite(derived) ? derived : null;
  }
  return null;
};

type StudentAggregate = {
  studentId: number;
  studentName: string;
  className: string | null;
  sum: number;
  count: number;
};

type SubjectAggregate = {
  subject: string;
  sum: number;
  count: number;
};

type TermAggregate = {
  term: (typeof TERM_SEQUENCE)[number];
  sum: number;
  count: number;
};

const emptyResponse = {
  data: {
    bestStudents: [] as unknown[],
    strugglingStudents: [] as unknown[],
    subjectAverages: [] as unknown[],
    termTrends: [] as unknown[],
    totals: {
      records: 0,
      students: 0,
      subjects: 0,
      lastUpdated: null as string | null,
    },
  },
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

    const { schoolId, sessionId, term, examType, limit } = parsed.data;
    const maxEntries = limit ?? 5;
    const examTypeFilter = normaliseExamType(examType);
    const termFilter = buildTermKey(term);

    let classIdFilter: string[] | null = null;
    if (schoolId) {
      const classes = await prisma.schoolClass.findMany({
        where: { schoolId },
        select: { id: true },
      });

      if (!classes.length) {
        return NextResponse.json(emptyResponse);
      }

      classIdFilter = classes.map((entry) => String(entry.id));
      if (!classIdFilter.length) {
        return NextResponse.json(emptyResponse);
      }
    }

    const where: Prisma.StudentScoreRecordWhereInput = {};
    if (classIdFilter) {
      where.classId = { in: classIdFilter };
    }
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (examTypeFilter) {
      where.examType = examTypeFilter;
    }

    const records = await prisma.studentScoreRecord.findMany({
      where,
      select: {
        studentId: true,
        studentName: true,
        className: true,
        subject: true,
        percentage: true,
        totalScore: true,
        maxScore: true,
        term: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!records.length) {
      return NextResponse.json(emptyResponse);
    }

    const filteredRecords = termFilter
      ? records.filter((record) => normaliseTermLabel(record.term) === termFilter)
      : records;

    const studentMap = new Map<number, StudentAggregate>();
    const subjectMap = new Map<string, SubjectAggregate>();
    const termMap = new Map<(typeof TERM_SEQUENCE)[number], TermAggregate>();

    let lastUpdated: Date | null = null;
    let validRecordCount = 0;

    for (const record of records) {
      const percentage = normalisePercentage(record);
      if (percentage === null) {
        continue;
      }

      validRecordCount += 1;
      if (!lastUpdated || record.updatedAt > lastUpdated) {
        lastUpdated = record.updatedAt;
      }

      const termLabel = normaliseTermLabel(record.term);
      if (termLabel) {
        const termEntry = termMap.get(termLabel) ?? {
          term: termLabel,
          sum: 0,
          count: 0,
        };
        termEntry.sum += percentage;
        termEntry.count += 1;
        termMap.set(termLabel, termEntry);
      }
    }

    for (const record of filteredRecords) {
      const percentage = normalisePercentage(record);
      if (percentage === null) {
        continue;
      }

      const studentEntry = studentMap.get(record.studentId) ?? {
        studentId: record.studentId,
        studentName: record.studentName || "Student",
        className: record.className ?? null,
        sum: 0,
        count: 0,
      };
      studentEntry.sum += percentage;
      studentEntry.count += 1;
      if (record.className && !studentEntry.className) {
        studentEntry.className = record.className;
      }
      studentMap.set(record.studentId, studentEntry);

      const subjectKey = record.subject?.trim() || "Subject";
      const subjectEntry = subjectMap.get(subjectKey) ?? {
        subject: subjectKey,
        sum: 0,
        count: 0,
      };
      subjectEntry.sum += percentage;
      subjectEntry.count += 1;
      subjectMap.set(subjectKey, subjectEntry);
    }

    const studentSummaries = Array.from(studentMap.values()).map((entry) => ({
      studentId: entry.studentId,
      studentName: entry.studentName,
      className: entry.className,
      average: entry.count ? entry.sum / entry.count : 0,
      examsTaken: entry.count,
    }));

    const sortedByAverage = studentSummaries.slice().sort((a, b) => b.average - a.average);
    const bestStudents = sortedByAverage.slice(0, maxEntries);
    const bestIds = new Set(bestStudents.map((student) => student.studentId));

    const strugglingStudents = studentSummaries
      .slice()
      .sort((a, b) => a.average - b.average)
      .filter((student) => !bestIds.has(student.studentId))
      .slice(0, maxEntries);

    const subjectAverages = Array.from(subjectMap.values())
      .map((entry) => ({
        subject: entry.subject,
        average: entry.count ? entry.sum / entry.count : 0,
        examsTaken: entry.count,
      }))
      .sort((a, b) => b.average - a.average);

    const termSummaries = TERM_SEQUENCE.map((termLabel) => {
      const entry = termMap.get(termLabel);
      const average = entry && entry.count ? entry.sum / entry.count : null;
      return average !== null
        ? {
            term: termLabel,
            average,
          }
        : null;
    }).filter(
      (summary): summary is { term: (typeof TERM_SEQUENCE)[number]; average: number } =>
        summary !== null,
    );

    const termTrends = termSummaries.map((summary, index, array) => {
      if (index === 0) {
        return {
          term: summary.term,
          average: Number(summary.average.toFixed(2)),
          difference: null,
          direction: "baseline" as const,
        };
      }

      const previous = array[index - 1];
      const difference = summary.average - previous.average;
      let direction: "up" | "down" | "flat";
      if (Math.abs(difference) < 0.01) {
        direction = "flat";
      } else if (difference > 0) {
        direction = "up";
      } else {
        direction = "down";
      }

      return {
        term: summary.term,
        average: Number(summary.average.toFixed(2)),
        difference: Number(difference.toFixed(2)),
        direction,
      };
    });

    return NextResponse.json({
      data: {
        bestStudents: bestStudents.map((student) => ({
          ...student,
          average: Number(student.average.toFixed(2)),
        })),
        strugglingStudents: strugglingStudents.map((student) => ({
          ...student,
          average: Number(student.average.toFixed(2)),
        })),
        subjectAverages: subjectAverages.map((subject) => ({
          ...subject,
          average: Number(subject.average.toFixed(2)),
        })),
        termTrends: termTrends,
        totals: {
          records: validRecordCount,
          students: studentSummaries.length,
          subjects: subjectAverages.length,
          lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        },
      },
    });
  } catch (error) {
    console.error("[DashboardPerformance] Failed to load insights", error);
    return NextResponse.json(
      { message: "Unable to load performance insights." },
      { status: 500 },
    );
  }
}
