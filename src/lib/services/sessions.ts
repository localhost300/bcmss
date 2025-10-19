import crypto from "node:crypto";
import { AcademicSession, Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { InvalidIdError, NotFoundError } from "./errors";
import { coerceToStringId } from "./utils";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

type SaveSessionInput = {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent?: boolean;
};

type ListSessionsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  isCurrent?: boolean;
};

type ListSessionsResult = {
  items: AcademicSession[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const normaliseFlag = (value?: boolean): boolean => Boolean(value);

const buildSessionId = (value?: string): string => {
  if (value && value.trim()) {
    return value.trim();
  }

  return crypto.randomUUID();
};

const sanitizePaging = ({
  page,
  pageSize,
}: {
  page?: number;
  pageSize?: number;
} = {}): { page: number; pageSize: number } => {
  const safePageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page ?? 1, 1);
  return { page: safePage, pageSize: safePageSize };
};

export async function listSessions(filters: ListSessionsFilters = {}): Promise<ListSessionsResult> {
  const { page, pageSize } = sanitizePaging(filters);
  const { search, isCurrent } = filters;

  const where: Prisma.AcademicSessionWhereInput = {};

  if (search && search.trim()) {
    const query = search.trim();
    where.OR = [
      { id: { contains: query, mode: "insensitive" } },
      { name: { contains: query, mode: "insensitive" } },
    ];
  }

  if (typeof isCurrent === "boolean") {
    where.isCurrent = isCurrent;
  }

  const skip = (page - 1) * pageSize;

  const [items, totalItems] = await Promise.all([
    prisma.academicSession.findMany({
      where,
      orderBy: [{ startDate: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.academicSession.count({ where }),
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

export async function createSession(input: SaveSessionInput): Promise<AcademicSession> {
  const id = buildSessionId(input.id);

  if (normaliseFlag(input.isCurrent)) {
    await prisma.academicSession.updateMany({ data: { isCurrent: false } });
  }

  return prisma.academicSession.create({
    data: {
      id,
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: normaliseFlag(input.isCurrent),
    },
  });
}

export async function updateSession(
  id: string | undefined,
  input: SaveSessionInput,
): Promise<AcademicSession> {
  if (!id || !id.trim()) {
    throw new InvalidIdError("Session id is required.");
  }

  try {
    if (normaliseFlag(input.isCurrent)) {
      await prisma.academicSession.updateMany({ data: { isCurrent: false } });
    }

    return await prisma.academicSession.update({
      where: { id: id.trim() },
      data: {
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: normaliseFlag(input.isCurrent),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Session not found.");
    }
    throw error;
  }
}

export async function deleteSession(id: string | number | undefined): Promise<void> {
  const sessionId = coerceToStringId(id, "session");

  try {
    await prisma.academicSession.delete({ where: { id: sessionId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Session not found.");
    }
    throw error;
  }
}
