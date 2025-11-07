import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { resolveRequestActor } from "@/lib/auth/permissions";
import prisma from "@/lib/prisma";

const statusSchema = z.enum(["present", "late", "absent"]);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const getQuerySchema = z.object({
  classId: z
    .string()
    .min(1, "Class id is required.")
    .transform((value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Class id must be a positive number.");
      }
      return parsed;
    }),
  date: z
    .string()
    .regex(dateRegex, "Date must be provided in YYYY-MM-DD format."),
});

const postPayloadSchema = z.object({
  classId: z.number().int().positive(),
  date: z.string().regex(dateRegex, "Date must be provided in YYYY-MM-DD format."),
  records: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: statusSchema,
        remarks: z
          .string()
          .trim()
          .max(255)
          .optional()
          .nullable(),
      }),
    )
    .min(1, "Provide at least one attendance record."),
});

const normaliseDateRange = (isoDate: string) => {
  const start = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid date supplied.");
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const computeTotals = (records: Array<{ status: string | null }>) => {
  return records.reduce(
    (acc, record) => {
      switch (record.status) {
        case "present":
          acc.present += 1;
          break;
        case "late":
          acc.late += 1;
          break;
        case "absent":
          acc.absent += 1;
          break;
        default:
          acc.unmarked += 1;
      }
      return acc;
    },
    { present: 0, late: 0, absent: 0, unmarked: 0 },
  );
};

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "You do not have permission to view attendance records." },
        { status: 403 },
      );
    }

    const parsed = getQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { classId, date } = parsed.data;

    if (actor.isTeacher && !actor.allowedClassIds.has(String(classId))) {
      return NextResponse.json(
        { message: "You are not assigned to this class." },
        { status: 403 },
      );
    }

    const { start, end } = normaliseDateRange(date);

    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (!students.length) {
      return NextResponse.json({
        data: {
          date,
          classId,
          students: [],
          totals: { present: 0, late: 0, absent: 0, unmarked: 0 },
        },
      });
    }

    const studentIds = students.map((student) => student.id);

    const entries = await prisma.studentAttendance.findMany({
      where: {
        studentId: { in: studentIds },
        date: {
          gte: start,
          lt: end,
        },
      },
      select: {
        studentId: true,
        status: true,
        remarks: true,
      },
    });

    const statusByStudent = new Map<number, { status: string; remarks: string | null }>();
    entries.forEach((entry) => {
      statusByStudent.set(entry.studentId, {
        status: entry.status.toLowerCase(),
        remarks: entry.remarks ?? null,
      });
    });

    const mapped = students.map((student) => {
      const existing = statusByStudent.get(student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        status: existing?.status ?? null,
        remarks: existing?.remarks ?? null,
      };
    });

    const totals = computeTotals(mapped);

    return NextResponse.json({
      data: {
        date,
        classId,
        students: mapped,
        totals,
      },
    });
  } catch (error) {
    console.error("[Attendance API] Failed to list records", error);
    return NextResponse.json(
      { message: "Unable to load attendance records." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveRequestActor();
    if (!actor.clerkUserId) {
      return NextResponse.json({ message: "Authentication required." }, { status: 401 });
    }
    if (!actor.isAdmin && !actor.isTeacher) {
      return NextResponse.json(
        { message: "You do not have permission to update attendance records." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = postPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid payload supplied.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { classId, date, records } = parsed.data;

    if (actor.isTeacher && !actor.allowedClassIds.has(String(classId))) {
      return NextResponse.json(
        { message: "You are not assigned to this class." },
        { status: 403 },
      );
    }

    const uniqueStudentIds = Array.from(new Set(records.map((item) => item.studentId)));
    const students = await prisma.student.findMany({
      where: {
        classId,
        id: { in: uniqueStudentIds },
      },
      select: { id: true },
    });

    if (students.length !== uniqueStudentIds.length) {
      return NextResponse.json(
        { message: "One or more students do not belong to the selected class." },
        { status: 400 },
      );
    }

    const { start, end } = normaliseDateRange(date);

    await prisma.$transaction(async (tx) => {
      await tx.studentAttendance.deleteMany({
        where: {
          studentId: { in: uniqueStudentIds },
          date: {
            gte: start,
            lt: end,
          },
        },
      });

      await tx.studentAttendance.createMany({
        data: records.map((record) => ({
          studentId: record.studentId,
          date: start,
          status: record.status,
          remarks: record.remarks?.trim() || null,
        })),
      });
    });

    const totals = computeTotals(records);

    return NextResponse.json({
      message: "Attendance saved successfully.",
      totals,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload supplied.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("[Attendance API] Failed to save records", error);
    return NextResponse.json(
      { message: "Unable to save attendance records." },
      { status: 500 },
    );
  }
}
