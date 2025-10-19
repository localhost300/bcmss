
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createClass, listClasses, updateClass } from "@/lib/services/classes";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";
import { resolveRequestActor } from "@/lib/auth/permissions";

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
  section: z.string().trim().optional().nullable(),
  room: z.string().trim().optional().nullable(),
  supervisor: z.string().trim().optional().nullable(),
  capacity: z.number().int().min(1),
  grade: z.string().trim().min(1),
  formTeacherId: z.number().int().positive().nullable().optional(),
  schoolId: z.string().trim().min(1),
});

const normalisePayload = (raw: unknown) => {
  const parsed = requestSchema.parse(raw);
  return {
    ...parsed,
    capacity:
      typeof parsed.capacity === "number" ? parsed.capacity : Number(parsed.capacity),
    formTeacherId:
      parsed.formTeacherId === null || parsed.formTeacherId === undefined
        ? null
        : typeof parsed.formTeacherId === "number"
        ? parsed.formTeacherId
        : Number(parsed.formTeacherId),
  };
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);

    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json(
        { message: "Authentication required." },
        { status: 401 },
      );
    }

    if (actor.isTeacher && actor.teacherId == null) {
      return NextResponse.json(
        { message: "Teacher profile is not configured for this account." },
        { status: 403 },
      );
    }

    const result = await listClasses(
      actor.isTeacher
        ? { ...filters, teacherId: actor.teacherId ?? undefined }
        : filters,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request.", errors: error.flatten().fieldErrors }, { status: 400 });
    }
    console.error("[Classes API] Failed to load classes", error);
    return NextResponse.json({ message: "Unable to load classes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const classInput = {
      name: payload.name,
      code: payload.code ?? null,
      category: payload.category ?? null,
      section: payload.section ?? null,
      room: payload.room ?? null,
      supervisor: payload.supervisor ?? null,
      capacity: payload.capacity,
      grade: payload.grade,
      schoolId: payload.schoolId,
      formTeacherId: payload.formTeacherId ?? null,
    };

    if (payload.action === "create") {
      const record = await createClass(classInput);
      return NextResponse.json({ message: "Class created successfully.", data: record }, { status: 201 });
    }

    if (!payload.id) {
      return NextResponse.json({ message: "Class id is required for update." }, { status: 400 });
    }

    const record = await updateClass(payload.id, classInput);
    return NextResponse.json({ message: "Class updated successfully.", data: record });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request payload.", errors: error.flatten().fieldErrors }, { status: 400 });
    }
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "A class with these details already exists." }, { status: 409 });
    }

    console.error("[Classes API] Failed to process request", error);
    return NextResponse.json({ message: "Unable to process request at this time." }, { status: 500 });
  }
}
