import { Prisma, Subject } from "@prisma/client";

import prisma from "@/lib/prisma";
import { NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";
import { deleteExamCascade } from "./exams";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type SaveSubjectInput = {
  name: string;
  code?: string | null;
  category?: string | null;
  creditHours?: number | null;
  description?: string | null;
  schoolId: string;
  classIds: number[];
  teacherIds?: number[];
};

type ListSubjectsFilters = PaginationParams & {
  search?: string;
  schoolId?: string;
};

export type SubjectListItem = {
  id: number;
  name: string;
  code: string | null;
  category: string | null;
  creditHours: number | null;
  description: string | null;
  schoolId: string;
  schoolName: string;
  classes: Array<{ id: number; name: string }>;
  teachers: Array<{ id: number; name: string; teacherCode: string | null }>;
  teacherIds: number[];
};

export type ListSubjectsResult = {
  items: SubjectListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type SubjectDetail = SubjectListItem;

const normaliseOptional = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureClassIds = (classIds: number[]): number[] => {
  const unique = Array.from(
    new Set(classIds.filter((value) => Number.isInteger(value) && value > 0)),
  );
  if (unique.length === 0) {
    throw new Error("At least one class must be selected.");
  }
  return unique;
};

const normaliseTeacherIds = (teacherIds: number[] | undefined): number[] => {
  if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
    return [];
  }
  return Array.from(
    new Set(
      teacherIds.filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
};

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  category: true,
  creditHours: true,
  description: true,
  schoolId: true,
  school: { select: { id: true, name: true } },
  classes: { include: { class: { select: { id: true, name: true } } } },
  teachers: {
    include: {
      teacher: { select: { id: true, fullName: true, teacherCode: true } },
    },
  },
} satisfies Prisma.SubjectSelect;

type SubjectWithRelations = Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>;

const mapSubjectRecord = (record: SubjectWithRelations): SubjectListItem => ({
  id: record.id,
  name: record.name,
  code: record.code ?? null,
  category: record.category ?? null,
  creditHours: record.creditHours ?? null,
  description: record.description ?? null,
  schoolId: record.schoolId,
  schoolName: record.school?.name ?? "",
  classes: record.classes
    .map((relation) => relation.class)
    .filter((klass): klass is { id: number; name: string } => Boolean(klass)),
  teachers: record.teachers
    .map((relation) => {
      const teacher = relation.teacher;
      if (!teacher) return null;
      const code = teacher.teacherCode?.trim();
      const teacherEntry: SubjectListItem["teachers"][number] = {
        id: teacher.id,
        name: teacher.fullName ?? teacher.teacherCode ?? "Unnamed Teacher",
        teacherCode: code && code.length > 0 ? code : null,
      };
      return teacherEntry;
    })
    .filter(
      (
        teacher,
      ): teacher is SubjectListItem["teachers"][number] => Boolean(teacher),
    )
    .sort((a, b) => a.name.localeCompare(b.name)),
  teacherIds: record.teachers
    .map((relation) => relation.teacher?.id)
    .filter((id): id is number => typeof id === "number"),
});

const sanitizePaging = ({ page, pageSize }: PaginationParams = {}): { page: number; pageSize: number } => {
  const safePageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

const buildCreateData = (input: SaveSubjectInput) => {
  const code = normaliseOptional(input.code);
  const category = normaliseOptional(input.category);
  const description = normaliseOptional(input.description);

  return {
    name: input.name.trim(),
    code,
    category,
    creditHours: typeof input.creditHours === "number" ? input.creditHours : null,
    description,
    schoolId: input.schoolId.trim(),
  };
};

const buildUpdateData = (input: SaveSubjectInput) => {
  const code = normaliseOptional(input.code);
  const category = normaliseOptional(input.category);
  const description = normaliseOptional(input.description);

  return {
    name: input.name.trim(),
    code: { set: code },
    category: { set: category },
    creditHours: {
      set: typeof input.creditHours === "number" ? input.creditHours : null,
    },
    description: { set: description },
    schoolId: input.schoolId.trim(),
  };
};

export async function listSubjects(filters: ListSubjectsFilters = {}): Promise<ListSubjectsResult> {
  const { search, schoolId } = filters;
  const { page, pageSize } = sanitizePaging(filters);

  const where: Prisma.SubjectWhereInput = {};

  if (search) {
    const query = search.trim();
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }
  }

  if (schoolId && schoolId.trim()) {
    where.schoolId = schoolId.trim();
  }

  const skip = (page - 1) * pageSize;

  const [records, totalItems] = await Promise.all([
    prisma.subject.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: subjectSelect,
      skip,
      take: pageSize,
    }),
    prisma.subject.count({ where }),
  ]);

  const items = records.map(mapSubjectRecord);
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

export async function getSubjectById(id: string | number | undefined): Promise<SubjectDetail> {
  const subjectId = coerceToIntId(id, "subject");

  const record = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: subjectSelect,
  });

  if (!record) {
    throw new NotFoundError("Subject not found.");
  }

  return mapSubjectRecord(record);
}

export async function createSubject(input: SaveSubjectInput): Promise<Subject> {
  const classIds = ensureClassIds(input.classIds);
  const teacherIds = normaliseTeacherIds(input.teacherIds);

  return prisma.$transaction(async (tx) => {
    const subject = await tx.subject.create({
      data: buildCreateData(input),
    });

    await tx.subjectClass.createMany({
      data: classIds.map((classId) => ({ subjectId: subject.id, classId })),
      skipDuplicates: true,
    });

    if (teacherIds.length > 0) {
      await tx.teacherSubject.createMany({
        data: teacherIds.map((teacherId) => ({ subjectId: subject.id, teacherId })),
        skipDuplicates: true,
      });
    }

    return subject;
  });
}

export async function updateSubject(
  id: string | number | undefined,
  input: SaveSubjectInput,
): Promise<Subject> {
  const subjectId = coerceToIntId(id, "subject");
  const classIds = ensureClassIds(input.classIds);
  const teacherIds = normaliseTeacherIds(input.teacherIds);

  try {
    return await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.update({
        where: { id: subjectId },
        data: buildUpdateData(input),
      });

      await tx.subjectClass.deleteMany({ where: { subjectId } });
      await tx.subjectClass.createMany({
        data: classIds.map((classId) => ({ subjectId, classId })),
        skipDuplicates: true,
      });

       await tx.teacherSubject.deleteMany({ where: { subjectId } });
       if (teacherIds.length > 0) {
         await tx.teacherSubject.createMany({
           data: teacherIds.map((teacherId) => ({ subjectId, teacherId })),
           skipDuplicates: true,
         });
       }

      return subject;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Subject not found.");
    }
    throw error;
  }
}

export async function deleteSubjectCascade(
  client: Prisma.TransactionClient,
  subjectId: number,
): Promise<void> {
  const subject = await client.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, name: true },
  });

  if (!subject) {
    throw new NotFoundError("Subject not found.");
  }

  const exams = await client.exam.findMany({
    where: { subjectId: subject.id },
    select: { id: true },
  });

  for (const exam of exams) {
    await deleteExamCascade(client, exam.id);
  }

  await client.teacherSubject.deleteMany({ where: { subjectId: subject.id } });
  await client.subjectClass.deleteMany({ where: { subjectId: subject.id } });

  if (subject.name) {
    await client.studentScoreRecord.deleteMany({
      where: {
        subject: { equals: subject.name, mode: "insensitive" },
      },
    });
  }

  await client.subject.delete({ where: { id: subject.id } });
}

export async function deleteSubject(id: string | number | undefined): Promise<void> {
  const subjectId = coerceToIntId(id, "subject");

  try {
    await prisma.$transaction(async (tx) => {
      await deleteSubjectCascade(tx, subjectId);
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Subject not found.");
    }
    throw error;
  }
}
