import { Prisma, PrismaClient, Teacher } from "@prisma/client";

import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type SaveTeacherInput = {
  teacherCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photo?: string | null;
  schoolId: string;
  subjectNames: string[];
  classNames: string[];
};

type PrismaClientOrTransaction = Prisma.TransactionClient | PrismaClient;

type TeacherRelationPayload = {
  subjectIds: number[];
  classIds: number[];
};

type ListTeachersFilters = PaginationParams & {
  search?: string;
  schoolId?: string;
};

export type TeacherListItem = {
  id: number;
  teacherId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  photo: string | null;
  schoolId: string;
  schoolName: string;
  subjects: string[];
  classes: string[];
};

export type ListTeachersResult = {
  items: TeacherListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type TeacherDetail = TeacherListItem;

const sanitizePaging = ({ page, pageSize }: PaginationParams = {}): { page: number; pageSize: number } => {
  const safePageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

const teacherInclude = {
  school: { select: { id: true, name: true } },
  subjects: { include: { subject: { select: { name: true } } } },
  classes: { include: { class: { select: { name: true } } } },
} satisfies Prisma.TeacherInclude;


type TeacherWithRelations = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>;

const normaliseOptional = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const uniqueNonEmpty = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));

const mapTeacherRecord = (record: TeacherWithRelations): TeacherListItem => {
  const subjects = Array.from(
    new Set(
      record.subjects
        .map((relation) => relation.subject?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  const classes = Array.from(
    new Set(
      record.classes
        .map((relation) => relation.class?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  return {
    id: record.id,
    teacherId: record.teacherCode,
    name: record.fullName?.trim() || record.teacherCode,
    email: record.email ?? null,
    phone: record.phone ?? null,
    address: record.address ?? null,
    photo: record.photo ?? null,
    schoolId: record.schoolId,
    schoolName: record.school?.name ?? "",
    subjects,
    classes,
  };
};

async function resolveTeacherRelations(
  client: PrismaClientOrTransaction,
  schoolId: string,
  subjectNames: string[],
  classNames: string[],
): Promise<TeacherRelationPayload> {
  const trimmedSchoolId = schoolId.trim();
  const subjectsToLink = uniqueNonEmpty(subjectNames);
  const classesToLink = uniqueNonEmpty(classNames);

  let subjectIds: number[] = [];
  if (subjectsToLink.length > 0) {
    const subjects = await client.subject.findMany({
      where: {
        schoolId: trimmedSchoolId,
        name: { in: subjectsToLink },
      },
      select: { id: true },
    });

    if (subjects.length !== subjectsToLink.length) {
      throw new NotFoundError("One or more selected subjects could not be found.");
    }

    subjectIds = subjects.map(({ id }) => id);
  }

  let classIds: number[] = [];
  if (classesToLink.length > 0) {
    const classes = await client.schoolClass.findMany({
      where: {
        schoolId: trimmedSchoolId,
        name: { in: classesToLink },
      },
      select: { id: true },
    });

    if (classes.length !== classesToLink.length) {
      throw new NotFoundError("One or more selected classes could not be found.");
    }

    classIds = classes.map(({ id }) => id);
  }

  return { subjectIds, classIds };
}

async function applyTeacherRelations(
  client: PrismaClientOrTransaction,
  teacherId: number,
  relations: TeacherRelationPayload,
): Promise<void> {
  const { subjectIds, classIds } = relations;

  if (subjectIds.length > 0) {
    await client.teacherSubject.createMany({
      data: subjectIds.map((subjectId) => ({ teacherId, subjectId })),
      skipDuplicates: true,
    });
  }

  if (classIds.length > 0) {
    await client.teacherClass.createMany({
      data: classIds.map((classId) => ({ teacherId, classId })),
      skipDuplicates: true,
    });
  }
}

export async function listTeachers(filters: ListTeachersFilters = {}): Promise<ListTeachersResult> {
  const { search, schoolId } = filters;
  const { page, pageSize } = sanitizePaging(filters);

  const where: Prisma.TeacherWhereInput = {};

  if (search) {
    const query = search.trim();
    if (query) {
      where.OR = [
        { fullName: { contains: query, mode: "insensitive" } },
        { teacherCode: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  if (schoolId && schoolId.trim()) {
    where.schoolId = schoolId.trim();
  }

  const skip = (page - 1) * pageSize;

  const [records, totalItems] = await Promise.all([
    prisma.teacher.findMany({
      where,
      orderBy: [{ fullName: "asc" }, { teacherCode: "asc" }],
      include: teacherInclude,
      skip,
      take: pageSize,
    }),
    prisma.teacher.count({ where }),
  ]);

  const items = records.map(mapTeacherRecord);
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

export async function getTeacherById(id: string | number | undefined): Promise<TeacherDetail> {
  const teacherId = coerceToIntId(id, "teacher");

  const record = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: teacherInclude,
  });

  if (!record) {
    throw new NotFoundError("Teacher not found.");
  }

  return mapTeacherRecord(record);
}

export async function createTeacher(input: SaveTeacherInput): Promise<Teacher> {
  const schoolId = input.schoolId.trim();
  const relationPayload = await resolveTeacherRelations(
    prisma,
    schoolId,
    input.subjectNames,
    input.classNames,
  );

  const teacher = await prisma.teacher.create({
    data: {
      teacherCode: input.teacherCode.trim(),
      fullName: input.fullName.trim(),
      email: normaliseOptional(input.email),
      phone: normaliseOptional(input.phone),
      address: normaliseOptional(input.address),
      photo: normaliseOptional(input.photo),
      schoolId,
    },
  });

  try {
    await applyTeacherRelations(prisma, teacher.id, relationPayload);
  } catch (error) {
    await prisma.teacher.delete({ where: { id: teacher.id } }).catch(() => undefined);
    throw error;
  }

  return teacher;
}
export async function updateTeacher(
  id: string | number | undefined,
  input: SaveTeacherInput,
): Promise<Teacher> {
  const teacherId = coerceToIntId(id, "teacher");
  const schoolId = input.schoolId.trim();
  const relationPayload = await resolveTeacherRelations(
    prisma,
    schoolId,
    input.subjectNames,
    input.classNames,
  );

  try {
    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: {
        teacherCode: input.teacherCode.trim(),
        fullName: input.fullName.trim(),
        email: normaliseOptional(input.email),
        phone: normaliseOptional(input.phone),
        address: normaliseOptional(input.address),
        photo: normaliseOptional(input.photo),
        schoolId,
      },
    });

    await prisma.teacherSubject.deleteMany({ where: { teacherId } });
    await prisma.teacherClass.deleteMany({ where: { teacherId } });
    await applyTeacherRelations(prisma, teacherId, relationPayload);

    return teacher;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Teacher not found.");
    }
    throw error;
  }
}
export async function deleteTeacher(id: string | number | undefined): Promise<void> {
  const teacherId = coerceToIntId(id, "teacher");

  try {
    await prisma.teacher.delete({ where: { id: teacherId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Teacher not found.");
    }
    throw error;
  }
}
