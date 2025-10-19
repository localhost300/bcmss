import { auth, currentUser } from "@clerk/nextjs/server";

import prisma from "@/lib/prisma";

type Role = "admin" | "teacher" | "student" | "parent";

type RawMetadata = Record<string, unknown> | null | undefined;

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normaliseSubjectName = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

export type RequestActor = {
  clerkUserId: string | null;
  role: Role | null;
  isAdmin: boolean;
  isTeacher: boolean;
  teacherId: number | null;
  allowedClassIds: Set<string>;
  allowedSubjectNames: Set<string>;
};

export const resolveRequestActor = async (): Promise<RequestActor> => {
  const { userId } = auth();

  if (!userId) {
    return {
      clerkUserId: null,
      role: null,
      isAdmin: false,
      isTeacher: false,
      teacherId: null,
      allowedClassIds: new Set(),
      allowedSubjectNames: new Set(),
    };
  }

  const user = await currentUser().catch(() => null);
  const metadata: RawMetadata =
    (user?.publicMetadata as RawMetadata) ??
    ((user?.unsafeMetadata as RawMetadata) ?? null);
  const metaRecord = (metadata ?? {}) as Record<string, unknown>;

  const roleValue = typeof metaRecord.role === "string" ? (metaRecord.role as string) : null;
  const role: Role | null =
    roleValue === "admin" ||
    roleValue === "teacher" ||
    roleValue === "student" ||
    roleValue === "parent"
      ? roleValue
      : null;

  let teacherId = toNullableNumber(metaRecord["teacherId"]);

  const allowedClassIds = new Set<string>();
  const allowedSubjectNames = new Set<string>();

  if (role === "teacher") {
    let teacherRecord = null;

    if (teacherId != null) {
      teacherRecord = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          classes: { select: { classId: true } },
          subjects: {
            select: {
              subject: { select: { name: true } },
            },
          },
        },
      });
    }

    if (!teacherRecord) {
      const appUser = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      });

      if (appUser) {
        teacherRecord = await prisma.teacher.findFirst({
          where: { userId: appUser.id },
          include: {
            classes: { select: { classId: true } },
            subjects: {
              select: {
                subject: { select: { name: true } },
              },
            },
          },
        });
        teacherId = teacherRecord?.id ?? teacherId;
      }
    }

    if (teacherRecord) {
      teacherRecord.classes.forEach(({ classId }) => {
        if (typeof classId === "number" && Number.isFinite(classId)) {
          allowedClassIds.add(String(classId));
        }
      });
      teacherRecord.subjects.forEach(({ subject }) => {
        const key = normaliseSubjectName(subject?.name ?? null);
        if (key) {
          allowedSubjectNames.add(key);
        }
      });
    }
  }

  return {
    clerkUserId: userId,
    role,
    isAdmin: role === "admin",
    isTeacher: role === "teacher",
    teacherId: teacherId ?? null,
    allowedClassIds,
    allowedSubjectNames,
  };
};
