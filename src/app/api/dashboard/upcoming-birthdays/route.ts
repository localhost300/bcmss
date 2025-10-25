import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  schoolId: z.string().trim().optional(),
  limit: z.coerce.number().int().positive().max(20).optional(),
  range: z.coerce.number().int().positive().max(365).optional(),
});

const MS_PER_DAY = 86_400_000;

type StudentRecord = {
  id: number;
  name: string;
  className: string | null;
  dateOfBirth: Date | null;
};

const computeNextBirthday = (
  dateOfBirth: Date,
  today: Date,
): { nextDate: Date; daysUntil: number; ageTurning: number } | null => {
  if (!Number.isFinite(dateOfBirth.getTime())) {
    return null;
  }

  const dobMonth = dateOfBirth.getUTCMonth();
  const dobDate = dateOfBirth.getUTCDate();
  const currentYear = today.getUTCFullYear();

  let nextBirthday = new Date(Date.UTC(currentYear, dobMonth, dobDate));

  // Handle Feb 29th on non-leap years by celebrating on Feb 28th.
  if (dobMonth === 1 && dobDate === 29) {
    const isLeapYear =
      (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;
    if (!isLeapYear) {
      nextBirthday = new Date(Date.UTC(currentYear, 1, 28));
    }
  }

  if (nextBirthday < today) {
    nextBirthday = new Date(Date.UTC(currentYear + 1, dobMonth, dobDate));
    if (dobMonth === 1 && dobDate === 29) {
      const nextYear = currentYear + 1;
      const isLeapYear =
        (nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0;
      if (!isLeapYear) {
        nextBirthday = new Date(Date.UTC(nextYear, 1, 28));
      }
    }
  }

  const diffMs = nextBirthday.getTime() - today.getTime();
  const daysUntil = Math.round(diffMs / MS_PER_DAY);

  const ageTurning = nextBirthday.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  return { nextDate: nextBirthday, daysUntil, ageTurning };
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { schoolId, limit = 6, range = 45 } = parsed.data;

    let students: StudentRecord[] = [];

    try {
      students = await prisma.student.findMany({
        where: {
          dateOfBirth: { not: null },
          ...(schoolId ? { schoolId } : {}),
        },
        select: {
          id: true,
          name: true,
          className: true,
          dateOfBirth: true,
        },
      });
    } catch (error) {
      const isDatabaseUnavailable =
        error instanceof Prisma.PrismaClientInitializationError ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001");

      if (!isDatabaseUnavailable) {
        throw error;
      }

      console.warn(
        "[DashboardUpcomingBirthdays] Database unavailable, returning empty birthday list",
        error,
      );

      return NextResponse.json({
        data: {
          items: [],
          rangeDays: range,
          fetched: 0,
        },
      });
    }

    if (!students.length) {
      return NextResponse.json({
        data: { items: [], rangeDays: range, fetched: 0 },
      });
    }

    const today = new Date();
    const items = students
      .map((student) => {
        if (!student.dateOfBirth) {
          return null;
        }
        const projection = computeNextBirthday(student.dateOfBirth, today);
        if (!projection) {
          return null;
        }
        const { nextDate, daysUntil, ageTurning } = projection;

        return {
          studentId: student.id,
          studentName: student.name,
          className: student.className,
          nextBirthday: nextDate.toISOString(),
          birthdayLabel: nextDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          daysUntil,
          ageTurning,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => item.daysUntil >= 0 && item.daysUntil <= range)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, limit);

    return NextResponse.json({
      data: {
        items,
        rangeDays: range,
        fetched: students.length,
      },
    });
  } catch (error) {
    console.error("[DashboardUpcomingBirthdays] Failed to load data", error);
    return NextResponse.json(
      { message: "Unable to load upcoming birthdays." },
      { status: 500 },
    );
  }
}
