import { ExamType, Prisma, Term } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { createExam, updateExam } from "@/lib/services/exams";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 10;

const requestSchema = z.object({
  action: z.enum(["create", "update"]),
  id: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
  name: z.string().trim().min(1),
  date: z.string().trim().min(1),
  startTime: z.string().trim().min(1),
  endTime: z.string().trim().min(1),
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  examType: z.enum(["MIDTERM", "FINAL"]),
  term: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
  room: z.string().trim().optional().nullable(),
  invigilator: z.string().trim().optional().nullable(),
});

const normalisePayload = (raw: unknown) => requestSchema.parse(raw);

const parseDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InvalidIdError("Invalid exam date supplied.");
  }
  return date;
};

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normaliseTerm = (value: string | null): Term | undefined => {
  if (!value) return undefined;
  const key = value.toUpperCase() as keyof typeof Term;
  return (Term as Record<string, Term>)[key];
};

const normaliseExamType = (value: string | null): ExamType | undefined => {
  if (!value) return undefined;
  const key = value.toUpperCase() as keyof typeof ExamType;
  return (ExamType as Record<string, ExamType>)[key];
};

const normaliseTermFromSearch = (value: string): Term | undefined => {
  const normalised = value.replace(/\s+/g, "").toLowerCase();
  if (normalised === "firstterm" || normalised === "first") return Term.FIRST;
  if (normalised === "secondterm" || normalised === "second") return Term.SECOND;
  if (normalised === "thirdterm" || normalised === "third") return Term.THIRD;
  return undefined;
};

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const page = parsePositiveInt(params.get("page"), 1);
    const pageSize = parsePositiveInt(params.get("pageSize"), DEFAULT_PAGE_SIZE);

    const schoolId = params.get("schoolId") ?? undefined;
    const sessionId = params.get("sessionId") ?? undefined;
    const termFilter = normaliseTerm(params.get("term"));
    const examTypeFilter = normaliseExamType(params.get("examType"));
    const search = params.get("search")?.trim();

    const where: Prisma.ExamWhereInput = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (sessionId) {
      where.sessionId = sessionId;
    }
    if (termFilter) {
      where.term = termFilter;
    }
    if (examTypeFilter) {
      where.examType = examTypeFilter;
    }

    if (search) {
      const lower = search.toLowerCase();
      const derivedExamType =
        lower === "midterm" ? ExamType.MIDTERM : lower === "final" ? ExamType.FINAL : undefined;
      const derivedTerm = normaliseTermFromSearch(lower);

      const orConditions: Prisma.ExamWhereInput[] = [
        { name: { contains: search, mode: "insensitive" } },
        { assessmentWindow: { contains: search, mode: "insensitive" } },
        { class: { name: { contains: search, mode: "insensitive" } } },
        { subject: { name: { contains: search, mode: "insensitive" } } },
      ];

      if (derivedExamType) {
        orConditions.push({ examType: derivedExamType });
      }
      if (derivedTerm) {
        orConditions.push({ term: derivedTerm });
      }

      const existingAndConditions = where.AND
        ? Array.isArray(where.AND)
          ? [...where.AND]
          : [where.AND]
        : [];
      existingAndConditions.push({ OR: orConditions });
      where.AND = existingAndConditions;
    }

    const skip = (page - 1) * pageSize;

    const [totalItems, records] = await prisma.$transaction([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
        orderBy: [
          { examDate: "asc" },
          { name: "asc" },
        ],
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return NextResponse.json({
      items: records.map((record) => ({
        id: record.id,
        name: record.name,
        assessmentWindow: record.assessmentWindow,
        examDate: record.examDate?.toISOString(),
        examType: record.examType,
        term: record.term,
        startTime: record.startTime,
        endTime: record.endTime,
        room: record.room,
        invigilator: record.invigilator,
        classId: record.classId,
        className: record.class?.name ?? null,
        subjectId: record.subjectId,
        subjectName: record.subject?.name ?? null,
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[Exams API] Failed to load exams", error);
    return NextResponse.json(
      { message: "Unable to load exams." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const examType = ExamType[payload.examType as keyof typeof ExamType];
    const term = payload.term ? Term[payload.term as keyof typeof Term] : undefined;

    const examInput = {
      name: payload.name,
      examDate: parseDate(payload.date),
      startTime: payload.startTime,
      endTime: payload.endTime,
      room: payload.room ?? null,
      invigilator: payload.invigilator ?? null,
      classId: payload.classId,
      subjectId: payload.subjectId,
      examType,
      term,
    };

    if (payload.action === "create") {
      const record = await createExam(examInput);
      return NextResponse.json(
        { message: "Exam created successfully.", data: record },
        { status: 201 },
      );
    }

    if (!payload.id) {
      return NextResponse.json({ message: "Exam id is required for update." }, { status: 400 });
    }

    const record = await updateExam(payload.id, examInput);
    return NextResponse.json({ message: "Exam updated successfully.", data: record });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request payload.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "An exam with these details already exists." },
        { status: 409 },
      );
    }

    console.error("[Exams API] Failed to process request", error);
    return NextResponse.json(
      { message: "Unable to process request at this time." },
      { status: 500 },
    );
  }
}

