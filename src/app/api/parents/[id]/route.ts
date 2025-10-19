import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";

const parseParentId = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const parentId = parseParentId(params?.id);
  if (!parentId) {
    return NextResponse.json({ message: "Invalid parent id." }, { status: 400 });
  }

  try {
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        school: { select: { id: true, name: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                classId: true,
                className: true,
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return NextResponse.json({ message: "Parent not found." }, { status: 404 });
    }

    const students = parent.students
      .map((link) => {
        const student = link.student;
        if (!student) return null;
        return {
          id: student.id,
          name: student.name,
          classId:
            student.classId !== null && student.classId !== undefined
              ? String(student.classId)
              : null,
          className: student.className ?? null,
          relationship: link.relationship ?? null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    return NextResponse.json({
      id: parent.id,
      name: parent.name,
      email: parent.email ?? null,
      phone: parent.phone ?? null,
      address: parent.address ?? null,
      schoolId: parent.schoolId ?? null,
      schoolName: parent.school?.name ?? null,
      students,
    });
  } catch (error) {
    console.error("[Parents API] Failed to load parent profile", error);
    return NextResponse.json(
      { message: "Unable to load parent profile." },
      { status: 500 },
    );
  }
}
