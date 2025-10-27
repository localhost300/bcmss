import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveRequestActor } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";
import { listStudentTraits } from "@/lib/services/studentTraits";

const querySchema = z.object({
  term: z.string().trim().optional(),
  session: z.string().trim().optional(),
});

type SerialisedTraitRecord = {
  id: string;
  studentId: string;
  term: string;
  session: string;
  category: string;
  trait: string;
  score: number;
  createdBy: string;
  createdAt: string;
};

const groupByCategory = (records: SerialisedTraitRecord[]) => {
  return records.reduce<Record<string, SerialisedTraitRecord[]>>((acc, record) => {
    const bucket = record.category ?? "uncategorised";
    if (!acc[bucket]) {
      acc[bucket] = [];
    }
    acc[bucket].push(record);
    return acc;
  }, {});
};

export async function GET(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "Only administrators and assigned class teachers can view trait ratings." },
        { status: 403 },
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentCode: params.studentId },
      select: { studentCode: true, name: true, classId: true, className: true },
    });
    if (!student) {
      return NextResponse.json({ message: "Student could not be found." }, { status: 404 });
    }

    if (actor.isTeacher) {
      const classId = student.classId ? String(student.classId) : null;
      if (!classId || !actor.allowedClassIds.has(classId)) {
        return NextResponse.json(
          { message: "You are not assigned to this student's class." },
          { status: 403 },
        );
      }
    }

    const filters = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));

    const records = await listStudentTraits({
      studentId: student.studentCode,
      term: filters.term,
      session: filters.session,
    });

    const serialisedRecords = records.map((record) => ({
      id: record.id,
      studentId: record.studentId,
      term: record.term,
      session: record.session,
      category: record.category,
      trait: record.trait,
      score: record.score,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
    }));

    return NextResponse.json({
      student: {
        id: student.studentCode,
        name: student.name,
        classId: student.classId,
        className: student.className,
      },
      filters: {
        term: filters.term ?? null,
        session: filters.session ?? null,
      },
      categories: groupByCategory(serialisedRecords),
      records: serialisedRecords,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid filter parameters.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("[Traits API] Failed to fetch trait ratings", error);
    return NextResponse.json({ message: "Unable to load trait ratings." }, { status: 500 });
  }
}
