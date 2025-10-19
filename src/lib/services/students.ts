import { Prisma, PrismaClient, Student, StudentCategory } from "@prisma/client";

import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type SaveStudentInput = {
  studentCode: string;
  name: string;
  email?: string | null;
  address?: string | null;
  photo?: string | null;
  grade: number;
  category: string;
  className: string;
  schoolId: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  dateOfBirth?: Date | null;
  bloodType?: string | null;
  guardianParentId?: number | null;
  guardianRelationship?: string | null;
};

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

type ListStudentsFilters = PaginationParams & {
  search?: string;
  schoolId?: string;
  category?: string;
};

export type StudentListItem = {
  id: number;
  studentId: string;
  name: string;
  email: string | null;
  address: string | null;
  photo: string | null;
  grade: number | null;
  category: string | null;
  className: string | null;
  schoolId: string;
  schoolName: string;
  dateOfBirth: string | null;
  bloodType: string | null;
  guardianEmail: string | null;
};

export type ListStudentsResult = {
  items: StudentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type StudentDetail = StudentListItem & {
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

const sanitizePaging = ({ page, pageSize }: PaginationParams = {}): { page: number; pageSize: number } => {
  const safePageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

const normaliseOptional = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normaliseBloodType = (value?: string | null): string | null => {
  const trimmed = normaliseOptional(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.toUpperCase();
};

const mapCategory = (category: string): StudentCategory => {
  const normalised = category.trim().toUpperCase();
  if (!(normalised in StudentCategory)) {
    throw new Error("Invalid student category supplied.");
  }
  return StudentCategory[normalised as keyof typeof StudentCategory];
};

const prettifyCategory = (value?: StudentCategory | null): string | null => {
  if (!value) {
    return null;
  }
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const studentSelect = {
  id: true,
  studentCode: true,
  name: true,
  email: true,
  phone: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  address: true,
  photo: true,
  grade: true,
  category: true,
  schoolId: true,
  school: { select: { id: true, name: true } },
  className: true,
  class: { select: { name: true } },
  dateOfBirth: true,
  bloodType: true,
} satisfies Prisma.StudentSelect;

type StudentWithRelations = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

const mapStudentRecord = (record: StudentWithRelations): StudentDetail => {
  const schoolName = record.school?.name ?? "";
  const className = record.class?.name ?? record.className ?? null;

  return {
    id: record.id,
    studentId: record.studentCode,
    name: record.name,
    email: record.email ?? null,
    phone: record.phone ?? null,
    address: record.address ?? null,
    photo: record.photo ?? null,
    grade: record.grade ?? null,
    category: prettifyCategory(record.category),
    className,
    schoolId: record.schoolId,
    schoolName,
    dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString() : null,
    bloodType: record.bloodType ?? null,
    guardianEmail: record.guardianEmail ?? null,
    guardianName: record.guardianName ?? null,
    guardianPhone: record.guardianPhone ?? null,
  };
};

export async function listStudents(filters: ListStudentsFilters = {}): Promise<ListStudentsResult> {
  const { page, pageSize } = sanitizePaging(filters);
  const { search, schoolId, category } = filters;

  const where: Prisma.StudentWhereInput = {};

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { studentCode: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
       { guardianEmail: { contains: query, mode: "insensitive" } },
       { bloodType: { contains: query, mode: "insensitive" } },
      { className: { contains: query, mode: "insensitive" } },
    ];
  }

  if (schoolId && schoolId.trim()) {
    where.schoolId = schoolId.trim();
  }

  if (category && category.trim()) {
    const normalised = category.trim().toUpperCase();
    if (normalised in StudentCategory) {
      where.category = normalised as StudentCategory;
    }
  }

  const skip = (page - 1) * pageSize;

  const [records, totalItems] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ name: "asc" }, { studentCode: "asc" }],
      select: studentSelect,
      skip,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  const items = records.map((record) => {
    const detail = mapStudentRecord(record);
    // drop guardian info and non-list fields from list payload
    const {
      guardianName: _ignore1,
      guardianPhone: _ignore2,
      phone: _ignore3,
      ...listItem
    } = detail;
    return listItem;
  });

  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

  return {
    items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getStudentById(id: string | number | undefined): Promise<StudentDetail> {
  const studentId = coerceToIntId(id, "student");

  const record = await prisma.student.findUnique({
    where: { id: studentId },
    select: studentSelect,
  });

  if (!record) {
    throw new NotFoundError("Student not found.");
  }

  return mapStudentRecord(record);
}

const resolveGuardian = async (
  client: PrismaClientOrTransaction,
  input: SaveStudentInput,
): Promise<{
  parentId: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
}> => {
  if (input.guardianParentId) {
    const parent = await client.parent.findUnique({
      where: { id: input.guardianParentId },
    });

    if (!parent) {
      throw new NotFoundError("Selected guardian was not found.");
    }

    return {
      parentId: parent.id,
      name: parent.name ?? null,
      phone: parent.phone ?? null,
      email: parent.email ?? null,
    };
  }

  const name = normaliseOptional(input.guardianName);
  const phone = normaliseOptional(input.guardianPhone);
  const email = normaliseOptional(input.guardianEmail);

  if (!email) {
    // No email provided means we cannot create or link a parent account.
    return {
      parentId: null,
      name,
      phone,
      email: null,
    };
  }

  const parent = await client.parent.upsert({
    where: { email },
    update: {
      name: name ?? undefined,
      phone: phone ?? undefined,
      schoolId: input.schoolId?.trim() || undefined,
    },
    create: {
      name: name ?? email,
      email,
      phone: phone ?? null,
      schoolId: input.schoolId?.trim() || null,
    },
  });

  return {
    parentId: parent.id,
    name: parent.name ?? name ?? null,
    phone: parent.phone ?? phone ?? null,
    email: parent.email ?? email,
  };
};

export async function createStudent(input: SaveStudentInput): Promise<Student> {
  return prisma.$transaction(async (tx) => {
    const { classId, className } = await resolveClass(tx, input.className, input.schoolId);
    const guardian = await resolveGuardian(tx, input);

    const student = await tx.student.create({
      data: {
        studentCode: input.studentCode.trim(),
        name: input.name.trim(),
        email: normaliseOptional(input.email),
        address: normaliseOptional(input.address),
        photo: normaliseOptional(input.photo),
        grade: input.grade,
        category: mapCategory(input.category),
        classId,
        className,
        schoolId: input.schoolId.trim(),
        guardianName: guardian.name ?? normaliseOptional(input.guardianName),
        guardianPhone: guardian.phone ?? normaliseOptional(input.guardianPhone),
        guardianEmail: guardian.email ?? normaliseOptional(input.guardianEmail),
        dateOfBirth: input.dateOfBirth ?? null,
        bloodType: normaliseBloodType(input.bloodType),
      },
    });

    if (guardian.parentId) {
      await tx.studentParent.create({
        data: {
          studentId: student.id,
          parentId: guardian.parentId,
          relationship: normaliseOptional(input.guardianRelationship),
        },
      });
    }

    return student;
  });
}

export async function updateStudent(
  id: string | number | undefined,
  input: SaveStudentInput,
): Promise<Student> {
  const studentId = coerceToIntId(id, "student");

  return prisma.$transaction(async (tx) => {
    const { classId, className } = await resolveClass(tx, input.className, input.schoolId);
    const guardian = await resolveGuardian(tx, input);

    try {
      const student = await tx.student.update({
        where: { id: studentId },
        data: {
          studentCode: input.studentCode.trim(),
          name: input.name.trim(),
          email: normaliseOptional(input.email),
          address: normaliseOptional(input.address),
          photo: normaliseOptional(input.photo),
          grade: input.grade,
          category: mapCategory(input.category),
          classId,
          className,
          schoolId: input.schoolId.trim(),
          guardianName: guardian.name ?? normaliseOptional(input.guardianName),
          guardianPhone: guardian.phone ?? normaliseOptional(input.guardianPhone),
          guardianEmail: guardian.email ?? normaliseOptional(input.guardianEmail),
          dateOfBirth: input.dateOfBirth ?? null,
          bloodType: normaliseBloodType(input.bloodType),
        },
      });

      await tx.studentParent.deleteMany({ where: { studentId } });

      if (guardian.parentId) {
        await tx.studentParent.create({
          data: {
            studentId,
            parentId: guardian.parentId,
            relationship: normaliseOptional(input.guardianRelationship),
          },
        });
      }

      return student;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundError("Student not found.");
      }
      throw error;
    }
  });
}

export async function deleteStudent(id: string | number | undefined): Promise<void> {
  const studentId = coerceToIntId(id, "student");

  try {
    await prisma.student.delete({ where: { id: studentId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Student not found.");
    }
    throw error;
  }
}

const resolveClass = async (
  client: PrismaClientOrTransaction,
  className: string,
  schoolId: string,
) => {
  const trimmed = className.trim();
  if (!trimmed) {
    return { classId: null, className: null };
  }

  const schoolClass = await client.schoolClass.findFirst({
    where: {
      schoolId,
      name: trimmed,
    },
  });

  if (!schoolClass) {
    throw new NotFoundError("Class not found for the provided student.");
  }

  return { classId: schoolClass.id, className: schoolClass.name };
};
