import { Prisma, Student, StudentCategory } from "@prisma/client";

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
  phone?: string | null;
  address?: string | null;
  photo?: string | null;
  grade: number;
  category: string;
  className: string;
  schoolId: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
};

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
  phone: string | null;
  address: string | null;
  photo: string | null;
  grade: number | null;
  category: string | null;
  className: string | null;
  schoolId: string;
  schoolName: string;
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
  address: true,
  photo: true,
  grade: true,
  category: true,
  schoolId: true,
  school: { select: { id: true, name: true } },
  className: true,
  class: { select: { name: true } },
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
    // drop guardian info from list payload
    const { guardianName: _ignore1, guardianPhone: _ignore2, ...listItem } = detail;
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

export async function createStudent(input: SaveStudentInput): Promise<Student> {
  const { classId, className } = await resolveClass(input.className, input.schoolId);

  return prisma.student.create({
    data: {
      studentCode: input.studentCode.trim(),
      name: input.name.trim(),
      email: normaliseOptional(input.email),
      phone: normaliseOptional(input.phone),
      address: normaliseOptional(input.address),
      photo: normaliseOptional(input.photo),
      grade: input.grade,
      category: mapCategory(input.category),
      classId,
      className,
      schoolId: input.schoolId.trim(),
      guardianName: normaliseOptional(input.guardianName),
      guardianPhone: normaliseOptional(input.guardianPhone),
    },
  });
}

export async function updateStudent(
  id: string | number | undefined,
  input: SaveStudentInput,
): Promise<Student> {
  const studentId = coerceToIntId(id, "student");
  const { classId, className } = await resolveClass(input.className, input.schoolId);

  try {
    return await prisma.student.update({
      where: { id: studentId },
      data: {
        studentCode: input.studentCode.trim(),
        name: input.name.trim(),
        email: normaliseOptional(input.email),
        phone: normaliseOptional(input.phone),
        address: normaliseOptional(input.address),
        photo: normaliseOptional(input.photo),
        grade: input.grade,
        category: mapCategory(input.category),
        classId,
        className,
        schoolId: input.schoolId.trim(),
        guardianName: normaliseOptional(input.guardianName),
        guardianPhone: normaliseOptional(input.guardianPhone),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Student not found.");
    }
    throw error;
  }
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

const resolveClass = async (className: string, schoolId: string) => {
  const trimmed = className.trim();
  if (!trimmed) {
    return { classId: null, className: null };
  }

  const schoolClass = await prisma.schoolClass.findFirst({
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
