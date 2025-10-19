import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { createSchool, listSchools } from "@/lib/services/schools";
import { schoolCreateSchema, schoolQuerySchema } from "@/lib/validation/schools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const formatZodError = (error: z.ZodError) => ({
  message: "Invalid request.",
  errors: error.flatten().fieldErrors,
});

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = schoolQuerySchema.parse(raw);
    const result = await listSchools(filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("[Schools API] GET failed", error);
    return NextResponse.json(
      { message: "Unable to load schools." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const data = schoolCreateSchema.parse(json);
    const school = await createSchool({
      ...data,
      logo: data.logo?.trim() || null,
    });
    return NextResponse.json(
      { message: "School created successfully.", data: school },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "A school with this code or email already exists." },
        { status: 409 },
      );
    }
    console.error("[Schools API] POST failed", error);
    return NextResponse.json(
      { message: "Unable to create school." },
      { status: 500 },
    );
  }
}
