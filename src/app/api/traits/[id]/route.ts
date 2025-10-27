import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveRequestActor } from "@/lib/auth/permissions";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";
import { getTraitWithStudent, updateTraitScore } from "@/lib/services/studentTraits";

const requestSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "Only administrators and assigned class teachers can update trait ratings." },
        { status: 403 },
      );
    }

    const trait = await getTraitWithStudent(params.id);
    if (!trait) {
      return NextResponse.json({ message: "Trait rating could not be found." }, { status: 404 });
    }

    if (actor.isTeacher) {
      const classId = trait.student?.classId ? String(trait.student.classId) : null;
      if (!classId || !actor.allowedClassIds.has(classId)) {
        return NextResponse.json(
          { message: "You are not assigned to this student's class." },
          { status: 403 },
        );
      }
    }

    const json = await request.json();
    const payload = requestSchema.parse(json);

    const record = await updateTraitScore(trait.id, payload);
    return NextResponse.json({ message: "Trait rating updated successfully.", data: record });
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
    console.error("[Traits API] Failed to update trait rating", error);
    return NextResponse.json({ message: "Unable to update trait rating." }, { status: 500 });
  }
}
