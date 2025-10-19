import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  schoolId: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : undefined))
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);

    if (!parsed.success) {
      throw parsed.error;
    }

    const { schoolId } = parsed.data;

    const studentWhere = schoolId ? { schoolId } : undefined;
    const teacherWhere = schoolId ? { schoolId } : undefined;
    const parentWhere = schoolId ? { schoolId } : undefined;
    const staffWhere = schoolId ? { schoolId } : undefined;

    const [students, teachers, parents, staff] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.teacher.count({ where: teacherWhere }),
      prisma.parent.count({ where: parentWhere }),
      prisma.schoolManager.count({ where: staffWhere }),
    ]);

    return NextResponse.json({
      totals: {
        students,
        teachers,
        parents,
        staff,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("[DashboardSummary] Failed to load counts", error);
    return NextResponse.json(
      { message: "Unable to load dashboard counts." },
      { status: 500 },
    );
  }
}
