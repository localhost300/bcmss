import crypto from "node:crypto";
import { AcademicSession, Prisma, PrismaClient, Term } from "@prisma/client";

import prisma from "@/lib/prisma";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import { InvalidIdError, NotFoundError } from "./errors";
import { coerceToStringId } from "./utils";
import { deleteExamCascade } from "./exams";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 500;

const FALLBACK_SESSIONS: ReadonlyArray<SessionListItem> = Object.freeze([
  {
    id: "2024-2025",
    name: "2024/2025 Academic Session",
    startDate: new Date("2024-09-01T00:00:00.000Z"),
    endDate: new Date("2025-07-15T00:00:00.000Z"),
    isCurrent: true,
    createdAt: new Date("2024-09-01T00:00:00.000Z"),
    updatedAt: new Date("2024-09-01T00:00:00.000Z"),
    firstTermStart: null,
    secondTermStart: null,
    thirdTermStart: null,
  },
  {
    id: "2023-2024",
    name: "2023/2024 Academic Session",
    startDate: new Date("2023-09-01T00:00:00.000Z"),
    endDate: new Date("2024-07-15T00:00:00.000Z"),
    isCurrent: false,
    createdAt: new Date("2023-09-01T00:00:00.000Z"),
    updatedAt: new Date("2024-07-15T00:00:00.000Z"),
    firstTermStart: null,
    secondTermStart: null,
    thirdTermStart: null,
  },
]);

type TermStartMap = {
  firstTermStart?: Date | null;
  secondTermStart?: Date | null;
  thirdTermStart?: Date | null;
};

type SaveSessionInput = {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent?: boolean;
  termStarts?: TermStartMap;
};

type ListSessionsFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  isCurrent?: boolean;
};

type SessionListItem = AcademicSession & {
  firstTermStart: Date | null;
  secondTermStart: Date | null;
  thirdTermStart: Date | null;
};

type ListSessionsResult = {
  items: SessionListItem[];
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

type PrismaSessionWithTerms = Prisma.AcademicSessionGetPayload<{
  include: { termSchedules: true };
}>;

const TERM_KEY_ORDER: Array<{ key: keyof TermStartMap; term: Term }> = [
  { key: "firstTermStart", term: Term.FIRST },
  { key: "secondTermStart", term: Term.SECOND },
  { key: "thirdTermStart", term: Term.THIRD },
];

const toSessionListItem = (record: PrismaSessionWithTerms): SessionListItem => {
  const { termSchedules, ...session } = record;

  const lookup = {
    [Term.FIRST]: null as Date | null,
    [Term.SECOND]: null as Date | null,
    [Term.THIRD]: null as Date | null,
  };

  termSchedules.forEach((schedule) => {
    lookup[schedule.term] = schedule.startsAt;
  });

  return {
    ...session,
    firstTermStart: lookup[Term.FIRST],
    secondTermStart: lookup[Term.SECOND],
    thirdTermStart: lookup[Term.THIRD],
  };
};

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

const applyTermStarts = async (
  client: PrismaClientOrTransaction,
  sessionId: string,
  termStarts?: TermStartMap,
): Promise<void> => {
  await client.academicTermSchedule.deleteMany({ where: { sessionId } });

  if (!termStarts) {
    return;
  }

  const entries = TERM_KEY_ORDER.flatMap(({ key, term }) => {
    const startsAt = termStarts[key];
    if (!startsAt) {
      return [];
    }
    return [
      {
        sessionId,
        term,
        startsAt,
      },
    ];
  });

  if (entries.length === 0) {
    return;
  }

  await client.academicTermSchedule.createMany({
    data: entries,
    skipDuplicates: true,
  });
};

export async function listSessions(filters: ListSessionsFilters = {}): Promise<ListSessionsResult> {
  const { page, pageSize } = sanitizePaging(filters);
  const { search, isCurrent } = filters;

  const runDbQuery = async () => {
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

    return Promise.all([
      prisma.academicSession.findMany({
        where,
        orderBy: [{ startDate: "desc" }],
        include: { termSchedules: true },
        skip,
        take: pageSize,
      }),
      prisma.academicSession.count({ where }),
    ]);
  };

  const buildFallbackResult = (): ListSessionsResult => {
    const normalizedSearch = search?.trim().toLowerCase();

    let filtered = Array.from(FALLBACK_SESSIONS).sort(
      (a, b) => b.startDate.getTime() - a.startDate.getTime(),
    );

    if (normalizedSearch) {
      filtered = filtered.filter((session) => {
        const idMatch = session.id.toLowerCase().includes(normalizedSearch);
        const nameMatch = session.name.toLowerCase().includes(normalizedSearch);
        return idMatch || nameMatch;
      });
    }

    if (typeof isCurrent === "boolean") {
      filtered = filtered.filter((session) => session.isCurrent === isCurrent);
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((session) => ({ ...session }));

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
    const [records, totalItems] = await runDbQuery();

    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
    const items = (records as PrismaSessionWithTerms[]).map(toSessionListItem);

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
        "[Sessions service] Falling back to local seed data because the database is unavailable.",
      );
      return buildFallbackResult();
    }
    throw error;
  }
}

export async function createSession(input: SaveSessionInput): Promise<AcademicSession> {
  const id = buildSessionId(input.id);

  return prisma.$transaction(async (tx) => {
    if (normaliseFlag(input.isCurrent)) {
      await tx.academicSession.updateMany({ data: { isCurrent: false } });
    }

    const session = await tx.academicSession.create({
      data: {
        id,
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: normaliseFlag(input.isCurrent),
      },
    });

    await applyTermStarts(tx, session.id, input.termStarts);

    return session;
  });
}

export async function updateSession(
  id: string | undefined,
  input: SaveSessionInput,
): Promise<AcademicSession> {
  if (!id || !id.trim()) {
    throw new InvalidIdError("Session id is required.");
  }

  const sessionId = id.trim();

  try {
    return await prisma.$transaction(async (tx) => {
      if (normaliseFlag(input.isCurrent)) {
        await tx.academicSession.updateMany({ data: { isCurrent: false } });
      }

      const session = await tx.academicSession.update({
        where: { id: sessionId },
        data: {
          name: input.name.trim(),
          startDate: input.startDate,
          endDate: input.endDate,
          isCurrent: normaliseFlag(input.isCurrent),
        },
      });

      await applyTermStarts(tx, session.id, input.termStarts);

      return session;
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
    await prisma.$transaction(async (tx) => {
      const session = await tx.academicSession.findUnique({
        where: { id: sessionId },
        select: { id: true },
      });

      if (!session) {
        throw new NotFoundError("Session not found.");
      }

      const exams = await tx.exam.findMany({
        where: { sessionId },
        select: { id: true },
      });

      for (const exam of exams) {
        await deleteExamCascade(tx, exam.id);
      }

      await tx.markDistribution.deleteMany({ where: { sessionId } });
      await tx.studentScoreRecord.deleteMany({ where: { sessionId } });
      await tx.academicSessionOnSchool.deleteMany({ where: { sessionId } });
      await tx.academicSession.delete({ where: { id: sessionId } });
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Session not found.");
    }
    throw error;
  }
}
