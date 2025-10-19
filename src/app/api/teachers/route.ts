import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createTeacher, listTeachers, updateTeacher } from "@/lib/services/teachers";
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
  teacherId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
  address: z.string().trim().min(1),
  photo: z.string().trim().optional().nullable(),
  subjects: z.array(z.string().trim().min(1)).min(1),
  classes: z.array(z.string().trim().min(1)).min(1),
  schoolId: z.string().trim().min(1),
});

const normalisePayload = (raw: unknown) => requestSchema.parse(raw);

const uniqueList = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);
    const result = await listTeachers(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request.", errors: error.flatten().fieldErrors }, { status: 400 });
    }

    console.error("[Teacher API] Failed to load teachers", error);
    return NextResponse.json({ message: "Unable to load teachers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = normalisePayload(json);

    const teacherInput = {
      teacherCode: payload.teacherId,
      fullName: payload.name,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      photo: payload.photo ?? null,
      schoolId: payload.schoolId,
      subjectNames: uniqueList(payload.subjects),
      classNames: uniqueList(payload.classes),
    };

    if (payload.action === "create") {
      const record = await createTeacher(teacherInput);
      return NextResponse.json(
        { message: "Teacher created successfully.", data: record },
        { status: 201 },
      );
    }

    if (!payload.id) {
      return NextResponse.json({ message: "Teacher id is required for update." }, { status: 400 });
    }

    const record = await updateTeacher(payload.id, teacherInput);
    return NextResponse.json({ message: "Teacher updated successfully.", data: record });
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
      return NextResponse.json({ message: "A teacher with this identifier already exists." }, { status: 409 });
    }

    console.error("[Teacher API] Failed to process request", error);
    return NextResponse.json({ message: "Unable to process request at this time." }, { status: 500 });
  }
}
