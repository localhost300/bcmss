import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_PAGE_SIZE = 10;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  schoolId: z.string().trim().optional(),
});

const normaliseSearch = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = querySchema.parse(raw);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const search = normaliseSearch(filters.search);
    const schoolId = normaliseSearch(filters.schoolId);

    const where: Prisma.ParentWhereInput = {};

    if (schoolId) {
      where.schoolId = schoolId;
    }

    if (search) {
      const andConditions: Prisma.ParentWhereInput[] = [];

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          andConditions.push(...where.AND);
        } else {
          andConditions.push(where.AND);
        }
      }

      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          {
            students: {
              some: {
                student: { name: { contains: search, mode: "insensitive" } },
              },
            },
          },
        ],
      });

      where.AND = andConditions;
    }

    const [totalItems, parents] = await prisma.$transaction([
      prisma.parent.count({ where }),
      prisma.parent.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          students: {
            include: {
              student: { select: { id: true, name: true, className: true } },
            },
          },
        },
        orderBy: [{ name: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);

    const items = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      email: parent.email ?? null,
      phone: parent.phone ?? null,
      address: parent.address ?? null,
      schoolId: parent.schoolId ?? null,
      schoolName: parent.school?.name ?? null,
      students: parent.students
        .map((link) => ({
          id: link.student?.id ?? null,
          name: link.student?.name ?? "Unnamed Student",
          relationship: link.relationship ?? null,
          className: link.student?.className ?? null,
        }))
        .filter((student) => Boolean(student.id || student.name)),
    }));

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query parameters.", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    console.error("[Parents API] Failed to load parents", error);
    return NextResponse.json({ message: "Unable to load parent records." }, { status: 500 });
  }
}
