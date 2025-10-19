import { Exam, ExamType, Prisma, Term } from "@prisma/client";

import prisma from "@/lib/prisma";
import { InvalidIdError, NotFoundError } from "./errors";
import { coerceToIntId } from "./utils";

type SaveExamInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  examType?: ExamType;
  term?: Term;
  classId: number;
  subjectId: number;
  sessionId?: string;
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

const resolveSessionId = async (requestedSessionId?: string): Promise<string> => {
  if (requestedSessionId && requestedSessionId.trim()) {
    const session = await prisma.academicSession.findUnique({
      where: { id: requestedSessionId.trim() },
    });

    if (!session) {
      throw new NotFoundError("Selected academic session was not found.");
    }

    return session.id;
  }

  const currentSession = await prisma.academicSession.findFirst({
    where: { isCurrent: true },
    orderBy: { startDate: "desc" },
  });

  if (currentSession) {
    return currentSession.id;
  }

  const latestSession = await prisma.academicSession.findFirst({
    orderBy: { startDate: "desc" },
  });

  if (latestSession) {
    return latestSession.id;
  }

  throw new NotFoundError(
    "No academic session configured. Create or activate a session before scheduling exams.",
  );
};

export async function createExam(input: SaveExamInput): Promise<Exam> {
  if (input.endDate < input.startDate) {
    throw new InvalidIdError("End date cannot be earlier than start date.");
  }

  const { klass } = await resolveClassAndSubject(input.classId, input.subjectId);
  const sessionId = await resolveSessionId(input.sessionId);
  const assessmentWindow = JSON.stringify({
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
  });

  return prisma.exam.create({
    data: {
      name: input.name.trim(),
      examDate: input.startDate,
      assessmentWindow,
      startTime: null,
      endTime: null,
      room: null,
      invigilator: null,
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
  if (input.endDate < input.startDate) {
    throw new InvalidIdError("End date cannot be earlier than start date.");
  }

  const { klass } = await resolveClassAndSubject(input.classId, input.subjectId);
  const sessionId = input.sessionId ? await resolveSessionId(input.sessionId) : undefined;
  const assessmentWindow = JSON.stringify({
    startDate: input.startDate.toISOString(),
    endDate: input.endDate.toISOString(),
  });

  try {
    return await prisma.exam.update({
      where: { id: examId },
      data: {
        name: input.name.trim(),
        examDate: input.startDate,
        assessmentWindow,
        startTime: null,
        endTime: null,
        room: null,
        invigilator: null,
        examType: input.examType ?? ExamType.MIDTERM,
        term: input.term ?? Term.FIRST,
        schoolId: klass.schoolId,
        ...(sessionId ? { sessionId } : {}),
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
