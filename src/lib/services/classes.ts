
import { Prisma, SchoolClass } from "@prisma/client";

import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type SaveClassInput = {
  name: string;
  code?: string | null;
  category?: string | null;
  section?: string | null;
  room?: string | null;
  supervisor?: string | null;
  capacity: number;
  grade: string;
  schoolId: string;
  formTeacherId?: number | null;
};

type ListClassesFilters = PaginationParams & {
  search?: string;
  schoolId?: string;
  teacherId?: number;
};

export type ClassListItem = {
  id: number;
  name: string;
  code: string;
  category: string;
  section: string;
  room: string;
  supervisor: string;
  capacity: number;
  grade: string;
  schoolId: string;
  schoolName: string;
  formTeacherId: number | null;
  formTeacherName: string | null;
};

export type ListClassesResult = {
  items: ClassListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ClassDetail = ClassListItem;

const normaliseOptional = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normaliseTeacherId = (value?: number | null): number | null => {
  if (typeof value !== "number") {
    return null;
  }
  return value > 0 ? value : null;
};

const buildCreateData = (input: SaveClassInput): Prisma.SchoolClassUncheckedCreateInput => ({
  name: input.name.trim(),
  code: normaliseOptional(input.code),
  category: normaliseOptional(input.category),
  section: normaliseOptional(input.section),
  room: normaliseOptional(input.room),
  supervisor: normaliseOptional(input.supervisor),
  capacity: input.capacity,
  grade: input.grade.trim(),
  schoolId: input.schoolId.trim(),
  formTeacherId: normaliseTeacherId(input.formTeacherId),
});

const buildUpdateData = (input: SaveClassInput): Prisma.SchoolClassUncheckedUpdateInput => ({
  name: input.name.trim(),
  code: { set: normaliseOptional(input.code) },
  category: { set: normaliseOptional(input.category) },
  section: { set: normaliseOptional(input.section) },
  room: { set: normaliseOptional(input.room) },
  supervisor: { set: normaliseOptional(input.supervisor) },
  capacity: input.capacity,
  grade: input.grade.trim(),
  schoolId: input.schoolId.trim(),
  formTeacherId: { set: normaliseTeacherId(input.formTeacherId) },
});

const classInclude = {
  school: { select: { id: true, name: true } },
  formTeacher: { select: { id: true, fullName: true, teacherCode: true } },
} satisfies Prisma.SchoolClassInclude;

type ClassWithRelations = Prisma.SchoolClassGetPayload<{ include: typeof classInclude }>;

const mapClassRecord = (record: ClassWithRelations): ClassListItem => ({
  id: record.id,
  name: record.name,
  code: record.code ?? "",
  category: record.category ?? "",
  section: record.section ?? "",
  room: record.room ?? "",
  supervisor: record.supervisor ?? "",
  capacity: record.capacity,
  grade: record.grade,
  schoolId: record.schoolId,
  schoolName: record.school?.name ?? "",
  formTeacherId: record.formTeacherId ?? null,
  formTeacherName:
    record.formTeacher?.fullName ?? record.formTeacher?.teacherCode ?? null,
});

const sanitizePaging = ({ page, pageSize }: PaginationParams = {}): { page: number; pageSize: number } => {
  const safePageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

export async function listClasses(filters: ListClassesFilters = {}): Promise<ListClassesResult> {
  const { search, schoolId, teacherId } = filters;
  const { page, pageSize } = sanitizePaging(filters);

  const where: Prisma.SchoolClassWhereInput = {};

  if (search) {
    const query = search.trim();
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { section: { contains: query, mode: "insensitive" } },
        { supervisor: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  if (schoolId && schoolId.trim()) {
    where.schoolId = schoolId.trim();
  }

  if (typeof teacherId === "number" && Number.isFinite(teacherId)) {
    where.teachers = {
      some: { teacherId },
    };
  }

  const skip = (page - 1) * pageSize;

  const [records, totalItems] = await Promise.all([
    prisma.schoolClass.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: classInclude,
      skip,
      take: pageSize,
    }),
    prisma.schoolClass.count({ where }),
  ]);

  const items = records.map(mapClassRecord);
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

export async function getClassById(id: string | number | undefined): Promise<ClassDetail> {
  const classId = coerceToIntId(id, "class");

  const record = await prisma.schoolClass.findUnique({
    where: { id: classId },
    include: classInclude,
  });

  if (!record) {
    throw new NotFoundError("Class not found.");
  }

  return mapClassRecord(record);
}

export async function createClass(input: SaveClassInput): Promise<SchoolClass> {
  return prisma.schoolClass.create({ data: buildCreateData(input) });
}

export async function updateClass(id: string | number | undefined, input: SaveClassInput): Promise<SchoolClass> {
  const classId = coerceToIntId(id, "class");

  try {
    return await prisma.schoolClass.update({ where: { id: classId }, data: buildUpdateData(input) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Class not found.");
    }
    throw error;
  }
}

export async function deleteClass(id: string | number | undefined): Promise<void> {
  const classId = coerceToIntId(id, "class");

  try {
    await prisma.schoolClass.delete({ where: { id: classId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Class not found.");
    }
    throw error;
  }
}
