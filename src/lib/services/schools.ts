import { Prisma, School } from "@prisma/client";
import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { NotFoundError } from "./errors";
import { deleteClassCascade } from "./classes";
import { deleteSubjectCascade } from "./subjects";
import { deleteTeacherCascade } from "./teachers";
import { deleteStudentCascade } from "./students";
import { deleteExamCascade } from "./exams";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

const FALLBACK_SCHOOLS: ReadonlyArray<School> = Object.freeze([
  {
    id: "school-main",
    name: "Bishop Crowther Main Campus",
    code: "BCM",
    address: "1 Unity Road",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    phone: "+234700000001",
    email: "main@bishopcrowther.sch.ng",
    principal: "Mrs. Comfort Obi",
    established: "1986",
    logo: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
  {
    id: "school-annex",
    name: "Bishop Crowther Annex Campus",
    code: "BCA",
    address: "2 Lake View",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    phone: "+234700000002",
    email: "annex@bishopcrowther.sch.ng",
    principal: "Mr. Vincent Iro",
    established: "1994",
    logo: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  },
]);

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

type ListSchoolsFilters = PaginationParams & {
  search?: string;
  city?: string;
  state?: string;
  country?: string;
};

type ListSchoolsResult = {
  items: School[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type CreateSchoolInput = {
  id?: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  principal: string;
  established: string;
  logo?: string | null;
};

export type UpdateSchoolInput = Partial<
  Omit<CreateSchoolInput, "id">
> & {
  logo?: string | null;
};

const sanitizePaging = ({ page, pageSize }: PaginationParams = {}) => {
  const safePageSize = Math.min(
    Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

const normalizeLogo = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export async function listSchools(
  filters: ListSchoolsFilters = {},
): Promise<ListSchoolsResult> {
  const { search, city, state, country } = filters;
  const { page, pageSize } = sanitizePaging(filters);

  const runDbQuery = async () => {
    const where: Prisma.SchoolWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (state) {
      where.state = { contains: state, mode: "insensitive" };
    }

    if (country) {
      where.country = { contains: country, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;

    return Promise.all([
      prisma.school.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.school.count({ where }),
    ]);
  };

  const buildFallbackResult = (): ListSchoolsResult => {
    const normalizedSearch = search?.trim().toLowerCase();

    let filtered = Array.from(FALLBACK_SCHOOLS).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    if (normalizedSearch) {
      filtered = filtered.filter((school) => {
        const bucket = [school.name, school.code, school.city, school.state]
          .filter(Boolean)
          .map((value) => value.toLowerCase());
        return bucket.some((value) => value.includes(normalizedSearch));
      });
    }

    if (city) {
      const target = city.toLowerCase();
      filtered = filtered.filter((school) =>
        school.city.toLowerCase().includes(target),
      );
    }

    if (state) {
      const target = state.toLowerCase();
      filtered = filtered.filter((school) =>
        school.state.toLowerCase().includes(target),
      );
    }

    if (country) {
      const target = country.toLowerCase();
      filtered = filtered.filter((school) =>
        school.country.toLowerCase().includes(target),
      );
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      pagination: {
        page: totalPages === 0 ? 1 : safePage,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  };

  try {
    const [items, totalItems] = await runDbQuery();

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
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.warn(
        "[Schools service] Falling back to local seed data because the database is unavailable.",
      );
      return buildFallbackResult();
    }

    throw error;
  }
}

export async function createSchool(input: CreateSchoolInput): Promise<School> {
  const data: Prisma.SchoolUncheckedCreateInput = {
    id: (input.id?.trim() ?? randomUUID()),
    name: input.name.trim(),
    code: input.code.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    country: input.country.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    principal: input.principal.trim(),
    established: input.established.trim(),
    logo: normalizeLogo(input.logo) ?? null,
  };

  return prisma.school.create({ data });
}

export async function getSchoolById(id: string): Promise<School | null> {
  return prisma.school.findUnique({ where: { id } });
}

export async function updateSchool(
  id: string,
  input: UpdateSchoolInput,
): Promise<School> {
  const data: Prisma.SchoolUpdateInput = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.code !== undefined) data.code = input.code.trim();
  if (input.address !== undefined) data.address = input.address.trim();
  if (input.city !== undefined) data.city = input.city.trim();
  if (input.state !== undefined) data.state = input.state.trim();
  if (input.country !== undefined) data.country = input.country.trim();
  if (input.phone !== undefined) data.phone = input.phone.trim();
  if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
  if (input.principal !== undefined) data.principal = input.principal.trim();
  if (input.established !== undefined) data.established = input.established.trim();

  if (Object.prototype.hasOwnProperty.call(input, "logo")) {
    data.logo = normalizeLogo(input.logo) ?? null;
  }

  return prisma.school.update({ where: { id }, data });
}

export async function deleteSchool(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const school = await tx.school.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!school) {
      throw new NotFoundError("School not found.");
    }

    const classIds = await tx.schoolClass.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    for (const klass of classIds) {
      await deleteClassCascade(tx, klass.id);
    }

    const subjectIds = await tx.subject.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    for (const subject of subjectIds) {
      await deleteSubjectCascade(tx, subject.id);
    }

    const teacherIds = await tx.teacher.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    for (const teacher of teacherIds) {
      await deleteTeacherCascade(tx, teacher.id);
    }

    const studentIds = await tx.student.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    for (const student of studentIds) {
      await deleteStudentCascade(tx, student.id);
    }

    await tx.parent.deleteMany({ where: { schoolId: id } });
    await tx.schoolManager.deleteMany({ where: { schoolId: id } });
    await tx.academicSessionOnSchool.deleteMany({ where: { schoolId: id } });
    await tx.markDistribution.deleteMany({ where: { schoolId: id } });

    const remainingExams = await tx.exam.findMany({
      where: { schoolId: id },
      select: { id: true },
    });

    for (const exam of remainingExams) {
      await deleteExamCascade(tx, exam.id);
    }

    await tx.school.delete({ where: { id } });
  });
}
