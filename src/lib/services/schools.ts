import { Prisma, School } from "@prisma/client";
import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

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

  const [items, totalItems] = await Promise.all([
    prisma.school.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.school.count({ where }),
  ]);

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
  await prisma.school.delete({ where: { id } });
}
