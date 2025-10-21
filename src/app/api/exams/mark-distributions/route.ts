import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";

const termLabelToEnum = {
  "First Term": "FIRST",
  "Second Term": "SECOND",
  "Third Term": "THIRD",
} as const;

const termEnumToLabel = {
  FIRST: "First Term",
  SECOND: "Second Term",
  THIRD: "Third Term",
} as const;

const examTypeLabelToEnum = {
  midterm: "MIDTERM",
  final: "FINAL",
} as const;

const examTypeEnumToLabel = {
  MIDTERM: "midterm",
  FINAL: "final",
} as const;

const upsertPayload = z.object({
  id: z.string().optional(),
  schoolId: z.string().nullable().optional(),
  sessionId: z.string().min(1),
  term: z.enum(["First Term", "Second Term", "Third Term"]),
  examType: z.enum(["midterm", "final"]),
  title: z.string().min(1),
  components: z
    .array(
      z.object({
        componentId: z.string().min(1),
        label: z.string().min(1),
        weight: z.number().int().min(0),
        order: z.number().int().min(0).optional(),
      }),
    )
    .min(1),
});

const listQuery = z.object({
  sessionId: z.string().optional(),
  term: z.enum(["First Term", "Second Term", "Third Term"]).optional(),
  examType: z.enum(["midterm", "final"]).optional(),
  schoolId: z.string().optional(),
});

const mapDistribution = (
  distribution: {
    components: { componentId: string; label: string; weight: number; order: number }[];
  } & {
    id: string;
    sessionId: string;
    term: "FIRST" | "SECOND" | "THIRD";
    examType: "MIDTERM" | "FINAL";
    title: string;
  },
) => ({
  id: distribution.id,
  sessionId: distribution.sessionId,
  term: termEnumToLabel[distribution.term],
  examType: examTypeEnumToLabel[distribution.examType],
  title: distribution.title,
  components: distribution.components
    .sort((a, b) => a.order - b.order)
    .map((component) => ({
      id: component.componentId,
      label: component.label,
      weight: component.weight,
    })),
});

export async function GET(request: NextRequest) {
  try {
    const params = listQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
    const where: Record<string, unknown> = {};
    if (params.sessionId) where.sessionId = params.sessionId;
    if (params.schoolId) where.schoolId = params.schoolId;
    if (params.term) where.term = termLabelToEnum[params.term];
    if (params.examType) where.examType = examTypeLabelToEnum[params.examType];

    const distributions = await prisma.markDistribution.findMany({
      where,
      include: {
        components: true,
      },
      orderBy: [
        { sessionId: "desc" },
        { term: "asc" },
        { examType: "asc" },
      ],
    });

    return NextResponse.json({
      data: distributions.map(mapDistribution),
    });
  } catch (error) {
    console.error("[MarkDistributions] GET failed", error);
    return NextResponse.json({ message: "Unable to load mark distributions." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = upsertPayload.parse(await request.json());
    const termEnum = termLabelToEnum[body.term];
    const examTypeEnum = examTypeLabelToEnum[body.examType];

    const existing =
      body.id
        ? await prisma.markDistribution.findUnique({ where: { id: body.id } })
        : await prisma.markDistribution.findFirst({
            where: {
              schoolId: body.schoolId ?? null,
              sessionId: body.sessionId,
              term: termEnum,
              examType: examTypeEnum,
            },
          });

    const distribution = existing
      ? await prisma.markDistribution.update({
          where: { id: existing.id },
          data: {
            schoolId: body.schoolId ?? null,
            sessionId: body.sessionId,
            term: termEnum,
            examType: examTypeEnum,
            title: body.title,
            components: {
              deleteMany: {},
              create: body.components.map((component, index) => ({
                componentId: component.componentId,
                label: component.label,
                weight: component.weight,
                order: component.order ?? index,
              })),
            },
          },
          include: { components: true },
        })
      : await prisma.markDistribution.create({
          data: {
            schoolId: body.schoolId ?? null,
            sessionId: body.sessionId,
            term: termEnum,
            examType: examTypeEnum,
            title: body.title,
            components: {
              create: body.components.map((component, index) => ({
                componentId: component.componentId,
                label: component.label,
                weight: component.weight,
                order: component.order ?? index,
              })),
            },
          },
          include: { components: true },
        });

    return NextResponse.json({ data: mapDistribution(distribution) }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[MarkDistributions] POST failed", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid payload.", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to save mark distribution." }, { status: 500 });
  }
}
