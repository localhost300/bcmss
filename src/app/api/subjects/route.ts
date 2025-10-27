import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createSubject, listSubjects, updateSubject } from "@/lib/services/subjects";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
});

const requestSchema = z.object({
  action: z.enum(["create", "update"]),
  id: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
  name: z.string().trim().min(1),
  code: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  creditHours: z
    .union([z.number(), z.string().trim(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }),
  description: z.string().trim().optional().nullable(),
  classIds: z
    .array(z.union([z.number().int().positive(), z.string().trim().min(1)]))
    .min(1),
  schoolId: z.string().trim().min(1),
  teacherIds: z
    .array(z.union([z.number().int().positive(), z.string().trim().min(1)]))
    .optional()
    .default([]),
  classTeacherAssignments: z
    .array(
      z.object({
        classId: z.union([z.number().int().positive(), z.string().trim().min(1)]),
        teacherId: z
          .union([z.number().int().positive(), z.string().trim().min(1)])
          .optional()
          .nullable(),
      }),
    )
    .optional()
    .default([]),
});

const normalisePayload = (raw: unknown) => {
  const parsed = requestSchema.parse(raw);

  const classIds = parsed.classIds
    .map((value) => {
      if (typeof value === "number") {
        return value;
      }
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    })
    .filter((value): value is number => typeof value === "number" && value > 0);

  if (classIds.length === 0) {
    throw new InvalidIdError("At least one class must be selected.");
  }

  const teacherIds = parsed.teacherIds
    .map((value) => {
      if (typeof value === "number") {
        return value;
      }
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    })
    .filter((value): value is number => typeof value === "number" && value > 0);

  const classTeacherAssignments = (parsed.classTeacherAssignments ?? [])
    .map((assignment) => {
      const rawClassId = assignment.classId;
      const classId =
        typeof rawClassId === "number"
          ? rawClassId
          : Number.isFinite(Number(rawClassId))
          ? Number(rawClassId)
          : null;

      if (!classId || classId <= 0) {
        return null;
      }

      const rawTeacherId = assignment.teacherId;
      let teacherId: number | null = null;
      if (typeof rawTeacherId === "number") {
        teacherId = Number.isFinite(rawTeacherId) && rawTeacherId > 0 ? rawTeacherId : null;
      } else if (typeof rawTeacherId === "string" && rawTeacherId.trim().length > 0) {
        const parsedValue = Number(rawTeacherId);
        teacherId = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
      }

      return { classId, teacherId };
    })
    .filter(
      (
        assignment,
      ): assignment is { classId: number; teacherId: number | null } => assignment !== null,
    );

  return {
    action: parsed.action,
    id: parsed.id,
    name: parsed.name,
    code: parsed.code ?? null,
    category: parsed.category ?? null,
    creditHours: parsed.creditHours ?? null,
    description: parsed.description ?? null,
    classIds,
    schoolId: parsed.schoolId,
    teacherIds,
    classTeacherAssignments,
  };
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);
    const result = await listSubjects({
      page: filters.page,
      pageSize: filters.pageSize,
      search: filters.search,
      schoolId: filters.schoolId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("[Subjects API] Failed to load subjects", error);
    return NextResponse.json({ message: "Unable to load subjects." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const subjectInput = {
      name: payload.name,
      code: payload.code,
      category: payload.category,
      creditHours: payload.creditHours,
    description: payload.description,
    classIds: payload.classIds,
    schoolId: payload.schoolId,
    teacherIds: payload.teacherIds,
    classTeacherAssignments: payload.classTeacherAssignments,
  };

    if (payload.action === "create") {
      const record = await createSubject(subjectInput);
      return NextResponse.json(
        { message: "Subject created successfully.", data: record },
        { status: 201 },
      );
    }

    if (!payload.id) {
      return NextResponse.json({ message: "Subject id is required for update." }, { status: 400 });
    }

    const record = await updateSubject(payload.id, subjectInput);
    return NextResponse.json({ message: "Subject updated successfully.", data: record });
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
        { message: "A subject with these details already exists." },
        { status: 409 },
      );
    }

    console.error("[Subjects API] Failed to process request", error);
    return NextResponse.json({ message: "Unable to process request at this time." }, { status: 500 });
  }
}
