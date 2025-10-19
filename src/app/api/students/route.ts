import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  createStudent,
  listStudents,
  updateStudent,
} from "@/lib/services/students";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

const requestSchema = z.object({
  action: z.enum(["create", "update"]),
  id: z.union([z.string().trim().min(1), z.number().int().positive()]).optional(),
  studentId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().min(1).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  photo: z.string().trim().optional().nullable(),
  grade: z.number().int().min(1),
  className: z.string().trim().min(1),
  category: z.string().trim().min(1),
  guardianName: z.string().trim().optional().nullable(),
  guardianPhone: z.string().trim().optional().nullable(),
  schoolId: z.string().trim().min(1),
});

const normalisePayload = (raw: unknown) =>
  requestSchema.parse({
    ...(raw as Record<string, unknown>),
    grade:
      typeof (raw as Record<string, unknown>)?.grade === "string"
        ? Number((raw as Record<string, unknown>).grade)
        : (raw as Record<string, unknown>)?.grade,
  });

const normaliseString = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);
    const result = await listStudents(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("[Student API] Failed to load students", error);
    return NextResponse.json(
      { message: "Unable to load students." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const studentInput = {
      studentCode: payload.studentId,
      name: payload.name,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      photo: payload.photo ?? null,
      grade: payload.grade,
      category: payload.category,
      className: payload.className,
      schoolId: payload.schoolId,
      guardianName: normaliseString(payload.guardianName),
      guardianPhone: normaliseString(payload.guardianPhone),
    };

    if (payload.action === "create") {
      const record = await createStudent(studentInput);
      return NextResponse.json(
        { message: "Student created successfully.", data: record },
        { status: 201 },
      );
    }

    if (!payload.id) {
      return NextResponse.json(
        { message: "Student id is required for update." },
        { status: 400 },
      );
    }

    const record = await updateStudent(payload.id, studentInput);
    return NextResponse.json({ message: "Student updated successfully.", data: record });
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
        { message: "A student with this identifier already exists." },
        { status: 409 },
      );
    }

    console.error("[Student API] Failed to process request", error);
    return NextResponse.json(
      { message: "Unable to process request at this time." },
      { status: 500 },
    );
  }
}
