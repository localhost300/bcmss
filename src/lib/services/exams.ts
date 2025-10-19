import { Exam, ExamType, Prisma, Term } from "@prisma/client";

import prisma from "@/lib/prisma";
import { InvalidIdError, NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";

type SaveExamInput = {
  name: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  room?: string | null;
  invigilator?: string | null;
  examType?: ExamType;
  term?: Term;
  classId: number;
  subjectId: number;
};

const normaliseOptional = (value?: string | null): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveClassAndSubject = async (classId: number, subjectId: number) => {
  const [klass, subject] = await Promise.all([
    prisma.schoolClass.findUnique({ where: { id: classId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ]);

  if (!klass) {
    throw new NotFoundError("Class not found for the exam.");
  }
  if (!subject) {
    throw new NotFoundError("Subject not found for the exam.");
  }

  return { klass, subject };
};

const resolveSessionId = async (): Promise<string> => {
  const session = await prisma.academicSession.findFirst({
    where: { isCurrent: true },
    orderBy: { startDate: "desc" },
  });

  if (!session) {
    throw new NotFoundError("No active academic session configured."
    );
  }

  return session.id;
};

export async function createExam(input: SaveExamInput): Promise<Exam> {
  const { klass } = await resolveClassAndSubject(input.classId, input.subjectId);
  const sessionId = await resolveSessionId();

  return prisma.exam.create({
    data: {
      name: input.name.trim(),
      examDate: input.examDate,
      startTime: input.startTime,
      endTime: input.endTime,
      room: normaliseOptional(input.room),
      invigilator: normaliseOptional(input.invigilator),
      examType: input.examType ?? ExamType.MIDTERM,
      term: input.term ?? Term.FIRST,
      schoolId: klass.schoolId,
      sessionId,
      classId: input.classId,
      subjectId: input.subjectId,
    },
  });
}

export async function updateExam(
  id: string | number | undefined,
  input: SaveExamInput,
): Promise<Exam> {
  const examId = coerceToIntId(id, "exam");
  const { klass } = await resolveClassAndSubject(input.classId, input.subjectId);

  try {
    return await prisma.exam.update({
      where: { id: examId },
      data: {
        name: input.name.trim(),
        examDate: input.examDate,
        startTime: input.startTime,
        endTime: input.endTime,
        room: normaliseOptional(input.room),
        invigilator: normaliseOptional(input.invigilator),
        examType: input.examType ?? ExamType.MIDTERM,
        term: input.term ?? Term.FIRST,
        schoolId: klass.schoolId,
        classId: input.classId,
        subjectId: input.subjectId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Exam not found.");
    }
    throw error;
  }
}

export async function deleteExam(id: string | number | undefined): Promise<void> {
  const examId = coerceToIntId(id, "exam");

  try {
    await prisma.exam.delete({ where: { id: examId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new NotFoundError("Exam not found.");
    }
    throw error;
  }
}
