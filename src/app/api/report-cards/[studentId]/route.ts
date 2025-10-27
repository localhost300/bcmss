import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/auth/permissions";
import { buildStudentReportCard } from "@/lib/services/reportCards";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  term: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "You do not have permission to view report sheets." },
        { status: 403 },
      );
    }

    const rawQuery = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = querySchema.parse(rawQuery);

    const studentId = Number.parseInt(params.studentId, 10);
    if (!Number.isFinite(studentId)) {
      return NextResponse.json(
        { message: "Student identifier must be a valid number." },
        { status: 400 },
      );
    }

    const studentMeta = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, schoolId: true },
    });

    if (!studentMeta) {
      return NextResponse.json({ message: "Student record was not found." }, { status: 404 });
    }

    if (actor.isTeacher) {
      const classKey =
        studentMeta.classId !== null && studentMeta.classId !== undefined
          ? String(studentMeta.classId)
          : null;
      if (!classKey || !actor.allowedClassIds.has(classKey)) {
        return NextResponse.json(
          { message: "You are not assigned to this student's class." },
          { status: 403 },
        );
      }
    }

    const report = await buildStudentReportCard({
      studentId,
      sessionId: query.sessionId,
      termLabel: query.term,
    });

    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query parameters supplied.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    if (error instanceof InvalidIdError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("[ReportCard API] Failed to build report sheet", error);
    return NextResponse.json(
      { message: "Unable to generate report sheet. Please try again later." },
      { status: 500 },
    );
  }
}
