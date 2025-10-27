import { Prisma, StudentTrait } from "@prisma/client";

import prisma from "@/lib/prisma";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";
import { AFFECTIVE_TRAITS, PSYCHOMOTOR_TRAITS } from "@/lib/constants/traits";

export type TraitRatingInput = {
  category: string;
  trait: string;
  score: number;
};

export type ReplaceTraitPayload = {
  studentId: string;
  term: string;
  session: string;
  createdBy: string;
  ratings: TraitRatingInput[];
};

export type UpdateTraitPayload = {
  score: number;
};

export type TraitFilters = {
  studentId: string;
  term?: string | null;
  session?: string | null;
};

const SCORE_MIN = 1;
const SCORE_MAX = 5;

const CATEGORY_TRAITS = new Map<string, Set<string>>([
  ["psychomotor", new Set(PSYCHOMOTOR_TRAITS.map((item) => item.label))],
  ["affective", new Set(AFFECTIVE_TRAITS.map((item) => item.label))],
]);

const ALLOWED_CATEGORIES = new Set(CATEGORY_TRAITS.keys());

const normaliseScore = (value: number): number => {
  if (!Number.isInteger(value)) {
    throw new InvalidIdError("Trait scores must be whole numbers between 1 and 5.");
  }
  if (value < SCORE_MIN || value > SCORE_MAX) {
    throw new InvalidIdError("Trait scores must be between 1 and 5.");
  }
  return value;
};

const normaliseText = (value: string, field: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new InvalidIdError(`${field} is required.`);
  }
  if (trimmed.length > 128) {
    throw new InvalidIdError(`${field} is too long.`);
  }
  return trimmed;
};

const normaliseCategory = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_CATEGORIES.has(normalized)) {
    throw new InvalidIdError("Unsupported trait category supplied.");
  }
  return normalized;
};

const normaliseTraitName = (category: string, trait: string): string => {
  const validTraits = CATEGORY_TRAITS.get(category);
  if (!validTraits) {
    throw new InvalidIdError("Unsupported trait category supplied.");
  }
  const match = Array.from(validTraits).find(
    (item) => item.toLowerCase() === trait.trim().toLowerCase(),
  );
  if (!match) {
    throw new InvalidIdError("Unsupported trait entry supplied.");
  }
  return match;
};

const ensureStudentExists = async (studentCode: string) => {
  const student = await prisma.student.findUnique({
    where: { studentCode },
    select: { id: true, classId: true, schoolId: true },
  });
  if (!student) {
    throw new NotFoundError("Student could not be found.");
  }
  return student;
};

export async function replaceStudentTraits(payload: ReplaceTraitPayload): Promise<StudentTrait[]> {
  const studentId = normaliseText(payload.studentId, "Student identifier");
  const term = normaliseText(payload.term, "Term");
  const session = normaliseText(payload.session, "Session");
  const createdBy = normaliseText(payload.createdBy, "Created by");

  if (!Array.isArray(payload.ratings) || payload.ratings.length === 0) {
    throw new InvalidIdError("At least one trait rating is required.");
  }

  const ratings = payload.ratings.map((rating) => {
    const category = normaliseCategory(rating.category);
    return {
      category,
      trait: normaliseTraitName(category, rating.trait),
      score: normaliseScore(rating.score),
    };
  });

  await ensureStudentExists(studentId);

  return await prisma.$transaction(async (tx) => {
    await tx.studentTrait.deleteMany({
      where: {
        studentId,
        term,
        session,
      },
    });

    const createdRecords = await tx.studentTrait.createMany({
      data: ratings.map((rating) => ({
        studentId,
        term,
        session,
        category: rating.category,
        trait: rating.trait,
        score: rating.score,
        createdBy,
      })),
    });

    if (createdRecords.count !== ratings.length) {
      throw new Error("Unable to persist trait ratings.");
    }

    return tx.studentTrait.findMany({
      where: { studentId, term, session },
      orderBy: [{ category: "asc" }, { trait: "asc" }],
    });
  });
}

export async function updateTraitScore(id: string, payload: UpdateTraitPayload): Promise<StudentTrait> {
  const traitId = normaliseText(id, "Trait id");
  const score = normaliseScore(payload.score);

  try {
    return await prisma.studentTrait.update({
      where: { id: traitId },
      data: { score },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Trait rating could not be found.");
    }
    throw error;
  }
}

export async function listStudentTraits(filters: TraitFilters): Promise<StudentTrait[]> {
  const studentId = normaliseText(filters.studentId, "Student identifier");
  const term = filters.term?.trim();
  const session = filters.session?.trim();

  await ensureStudentExists(studentId);

  return prisma.studentTrait.findMany({
    where: {
      studentId,
      ...(term ? { term } : {}),
      ...(session ? { session } : {}),
    },
    orderBy: [{ category: "asc" }, { trait: "asc" }],
  });
}

export async function getTraitWithStudent(traitId: string) {
  const id = normaliseText(traitId, "Trait id");

  return prisma.studentTrait.findUnique({
    where: { id },
    include: {
      student: {
        select: {
          classId: true,
        },
      },
    },
  });
}
