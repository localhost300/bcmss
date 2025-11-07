import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { deleteSchool, updateSchool } from "@/lib/services/schools";
import { schoolUpdateSchema } from "@/lib/validation/schools";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

const idSchema = z
  .string()
  .trim()
  .min(1, "School id is required.");
const formatZodError = (error: z.ZodError) => ({
  message: "Invalid request.",
  errors: error.flatten().fieldErrors,
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const schoolId = idSchema.parse(params.id);
    const json = await request.json();
    const data = schoolUpdateSchema.parse(json);

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: "At least one field is required." },
        { status: 400 },
      );
    }

    const school = await updateSchool(schoolId, {
      ...data,
      logo:
        data.logo === null
          ? null
          : data.logo === undefined
          ? undefined
          : data.logo.trim() || null,
    });

    return NextResponse.json({
      message: "School updated successfully.",
      data: school,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { message: "A school with this code or email already exists." },
        { status: 409 },
      );
    }
    console.error("[Schools API] PATCH failed", error);
    return NextResponse.json(
      { message: "Unable to update school." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const schoolId = idSchema.parse(params.id);
    await deleteSchool(schoolId);
    return NextResponse.json({ message: "School deleted successfully." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatZodError(error), { status: 400 });
    }
    console.error("[Schools API] DELETE failed", error);
    return NextResponse.json(
      { message: "Unable to delete school." },
      { status: 500 },
    );
  }
}
