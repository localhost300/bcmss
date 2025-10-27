import { Prisma, StudentScoreRecord } from "@prisma/client";

import prisma from "@/lib/prisma";
import { getGradeForScore } from "@/lib/grades";
import { InvalidIdError, NotFoundError } from "@/lib/services/errors";

type ReportCardRequest = {
  studentId: number;
  sessionId: string;
  termLabel: string;
};

type TermLabel = "First Term" | "Second Term" | "Third Term";

type TraitEntry = {
  trait: string;
  score: number;
};

type SubjectBreakdown = {
  subject: string;
  ca1: number;
  ca2: number;
  exam: number;
  termTotal: number;
  grade: string;
  remark: string;
  position: number | null;
};

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number | null;
};

type TraitGroup = {
  category: "psychomotor" | "affective";
  traits: TraitEntry[];
};

type SubjectTotals = Map<number, number>;

type SubjectRanking = Map<number, number>;

type SubjectRankingMap = Map<string, SubjectRanking>;

type GradeAnalysis = {
  bestSubject: { name: string; score: number } | null;
  weakestSubject: { name: string; score: number } | null;
  totalScore: number;
  averageScore: number;
  totalSubjects: number;
};

export type ReportCardData = {
  school: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    phone: string;
    email: string;
    principal: string;
    logo: string | null;
  };
  session: {
    id: string;
    name: string;
    term: TermLabel;
    startDate: string | null;
    endDate: string | null;
  };
  student: {
    id: number;
    code: string;
    name: string;
    gender: string | null;
    classId: number | null;
    className: string | null;
    age: number | null;
    bestSubject: { name: string; score: number } | null;
    weakestSubject: { name: string; score: number } | null;
  };
  summaries: {
    totalScore: number;
    averageScore: number;
    classPosition: number | null;
    totalSubjects: number;
    totalPossible: number;
    attendance: AttendanceSummary;
  };
  classTeacher: {
    name: string | null;
  };
  subjects: SubjectBreakdown[];
  traits: TraitGroup[];
};

const TERM_NORMALISER: Record<string, TermLabel> = {
  "first term": "First Term",
  "first": "First Term",
  "second term": "Second Term",
  "second": "Second Term",
  "third term": "Third Term",
  "third": "Third Term",
};

const COMPONENT_MATCHERS = {
  ca1: ["ca1", "continuous assessment 1", "weekly test 1"],
  ca2: ["ca2", "continuous assessment 2", "assignment", "project", "test"],
  exam: ["exam", "examination", "paper"],
} as const;

const normaliseTerm = (term: string): TermLabel => {
  const key = term.trim().toLowerCase();
  const mapped = TERM_NORMALISER[key];
  if (!mapped) {
    throw new InvalidIdError("Unsupported academic term supplied.");
  }
  return mapped;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type ParsedComponent = {
  key: string;
  score: number;
};

const parseComponents = (payload: Prisma.JsonValue | null): ParsedComponent[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label : undefined;
      const componentId =
        typeof record.componentId === "string" ? record.componentId : undefined;
      const rawScore = asNumber(record.score);
      if (!Number.isFinite(rawScore ?? NaN)) {
        return null;
      }

      const keySource = (label ?? componentId ?? "").trim();
      if (!keySource) {
        return null;
      }

      return {
        key: keySource.toLowerCase(),
        score: rawScore ?? 0,
      };
    })
    .filter((item): item is ParsedComponent => Boolean(item));
};

const findComponentScore = (
  components: ParsedComponent[],
  keywords: readonly string[],
): number | null => {
  const match = components.find((component) =>
    keywords.some((keyword) => component.key.includes(keyword)),
  );
  return match ? match.score : null;
};

const sumComponents = (
  components: ParsedComponent[],
  predicate: (component: ParsedComponent) => boolean,
): number => {
  return components
    .filter(predicate)
    .reduce((accumulator, component) => accumulator + component.score, 0);
};

const roundToOneDecimal = (value: number): number => {
  return Math.round(value * 10) / 10;
};

const computeSubjectBreakdown = (
  finalRecord: StudentScoreRecord,
  midtermRecord: StudentScoreRecord | null,
): { ca1: number; ca2: number; exam: number; termTotal: number } => {
  const components = parseComponents(finalRecord.components);
  const ca1FromComponents = findComponentScore(components, COMPONENT_MATCHERS.ca1);
  let ca1 = Number.isFinite(ca1FromComponents ?? NaN)
    ? ca1FromComponents ?? 0
    : 0;

  if (!ca1 && midtermRecord) {
    const fallback = asNumber(midtermRecord.totalScore);
    if (Number.isFinite(fallback ?? NaN)) {
      ca1 = fallback ?? 0;
    }
  }

  const usedKeys = new Set<string>();
  if (ca1FromComponents) {
    usedKeys.add(
      components.find((component) =>
        COMPONENT_MATCHERS.ca1.some((keyword) => component.key.includes(keyword)),
      )?.key ?? "",
    );
  }

  const examComponent = components.find((component) =>
    COMPONENT_MATCHERS.exam.some((keyword) => component.key.includes(keyword)),
  );
  const exam = examComponent ? examComponent.score : 0;
  if (examComponent) {
    usedKeys.add(examComponent.key);
  }

  const ca2 = sumComponents(
    components,
    (component) =>
      !usedKeys.has(component.key) &&
      COMPONENT_MATCHERS.ca2.some((keyword) => component.key.includes(keyword)),
  );

  let termTotal = ca1 + ca2 + exam;
  const finalScore = asNumber(finalRecord.totalScore) ?? termTotal;
  // Adjust totals if stored score differs (tolerate rounding differences).
  if (Math.abs(finalScore - termTotal) > 0.5) {
    termTotal = finalScore;
  }

  return {
    ca1: roundToOneDecimal(ca1),
    ca2: roundToOneDecimal(ca2),
    exam: roundToOneDecimal(exam),
    termTotal: roundToOneDecimal(termTotal),
  };
};

const assignSubjectPositions = (
  subjectRecords: Map<string, Array<{ studentId: number; termTotal: number }>>,
): SubjectRankingMap => {
  const rankingMap: SubjectRankingMap = new Map();

  subjectRecords.forEach((records, subjectKey) => {
    const sorted = [...records].sort((a, b) => b.termTotal - a.termTotal);
    let position = 0;
    let lastScore: number | null = null;
    let index = 0;
    const ranking: SubjectRanking = new Map();

    sorted.forEach((entry) => {
      index += 1;
      if (lastScore === null || entry.termTotal < lastScore - 0.01) {
        position = index;
        lastScore = entry.termTotal;
      }
      ranking.set(entry.studentId, position);
    });

    rankingMap.set(subjectKey, ranking);
  });

  return rankingMap;
};

const computeClassPositions = (totals: SubjectTotals): Map<number, number> => {
  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const positions = new Map<number, number>();
  let position = 0;
  let lastScore: number | null = null;
  let index = 0;

  entries.forEach(([studentId, score]) => {
    index += 1;
    if (lastScore === null || score < lastScore - 0.01) {
      position = index;
      lastScore = score;
    }
    positions.set(studentId, position);
  });

  return positions;
};

const analyseSubjects = (
  subjects: SubjectBreakdown[],
): GradeAnalysis => {
  if (!subjects.length) {
    return {
      bestSubject: null,
      weakestSubject: null,
      totalScore: 0,
      averageScore: 0,
      totalSubjects: 0,
    };
  }

  let best: { name: string; score: number } | null = null;
  let weakest: { name: string; score: number } | null = null;
  let total = 0;

  subjects.forEach((subject) => {
    total += subject.termTotal;
    if (!best || subject.termTotal > best.score) {
      best = { name: subject.subject, score: subject.termTotal };
    }
    if (!weakest || subject.termTotal < weakest.score) {
      weakest = { name: subject.subject, score: subject.termTotal };
    }
  });

  const average = total / subjects.length;
  return {
    bestSubject: best,
    weakestSubject: weakest,
    totalScore: roundToOneDecimal(total),
    averageScore: roundToOneDecimal(average),
    totalSubjects: subjects.length,
  };
};

const computeAttendance = async (
  studentId: number,
  sessionStart: Date | null,
  sessionEnd: Date | null,
): Promise<AttendanceSummary> => {
  if (!sessionStart || !sessionEnd) {
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      percentage: null,
    };
  }

  const records = await prisma.studentAttendance.findMany({
    where: {
      studentId,
      date: {
        gte: sessionStart,
        lte: sessionEnd,
      },
    },
    select: {
      status: true,
    },
  });

  if (!records.length) {
    return {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      percentage: null,
    };
  }

  let present = 0;
  let absent = 0;
  let late = 0;

  records.forEach(({ status }) => {
    const label = (status ?? "").toString().trim().toLowerCase();
    if (!label) {
      return;
    }
    if (label.startsWith("pre") || label === "p") {
      present += 1;
    } else if (label.startsWith("lat") || label === "l") {
      late += 1;
    } else {
      absent += 1;
    }
  });

  const total = present + absent + late;
  const attended = present + late;
  const percentage =
    total > 0 ? roundToOneDecimal((attended / total) * 100) : null;

  return { total, present, absent, late, percentage };
};

const computeAge = (dateOfBirth: Date | null, reference: Date | null): number | null => {
  if (!dateOfBirth || !reference) {
    return null;
  }

  let age = reference.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = reference.getMonth() - dateOfBirth.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && reference.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }
  return age;
};

const groupTraits = (entries: Array<{ category: string; trait: string; score: number }>): TraitGroup[] => {
  if (!entries.length) {
    return [
      { category: "psychomotor", traits: [] },
      { category: "affective", traits: [] },
    ];
  }

  const grouped: Record<"psychomotor" | "affective", TraitEntry[]> = {
    psychomotor: [],
    affective: [],
  };

  entries.forEach((entry) => {
    if (entry.category === "psychomotor" || entry.category === "affective") {
      grouped[entry.category].push({
        trait: entry.trait,
        score: entry.score,
      });
    }
  });

  return [
    { category: "psychomotor", traits: grouped.psychomotor },
    { category: "affective", traits: grouped.affective },
  ];
};

export async function buildStudentReportCard({
  studentId,
  sessionId,
  termLabel,
}: ReportCardRequest): Promise<ReportCardData> {
  if (!Number.isFinite(studentId)) {
    throw new InvalidIdError("Student identifier is invalid.");
  }
  if (!sessionId || !sessionId.trim()) {
    throw new InvalidIdError("Session identifier is required.");
  }

  const term = normaliseTerm(termLabel);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      school: true,
      class: {
        include: {
          formTeacher: true,
        },
      },
    },
  });

  if (!student) {
    throw new NotFoundError("Student record could not be found.");
  }

  if (!student.school) {
    throw new InvalidIdError("Student is not linked to a school record.");
  }

  const classIdAsString =
    student.classId != null ? String(student.classId) : null;

  const session = await prisma.academicSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new NotFoundError("Academic session could not be found.");
  }

  const [finalRecords, midtermRecords] = await Promise.all([
    prisma.studentScoreRecord.findMany({
      where: {
        studentId,
        sessionId,
        term,
        examType: "final",
      },
    }),
    prisma.studentScoreRecord.findMany({
      where: {
        studentId,
        sessionId,
        term,
        examType: "midterm",
      },
    }),
  ]);

  if (!finalRecords.length) {
    throw new NotFoundError("No final exam records found for the selected student.");
  }

  const midtermLookup = new Map<string, StudentScoreRecord>();
  midtermRecords.forEach((record) => {
    midtermLookup.set(record.subject.toLowerCase(), record);
  });

  let classFinalRecords: StudentScoreRecord[] = [];
  let classMidtermRecords: StudentScoreRecord[] = [];

  if (classIdAsString) {
    [classFinalRecords, classMidtermRecords] = await Promise.all([
      prisma.studentScoreRecord.findMany({
        where: {
          classId: classIdAsString,
          sessionId,
          term,
          examType: "final",
        },
      }),
      prisma.studentScoreRecord.findMany({
        where: {
          classId: classIdAsString,
          sessionId,
          term,
          examType: "midterm",
        },
      }),
    ]);
  } else {
    classFinalRecords = [...finalRecords];
    classMidtermRecords = [...midtermRecords];
  }

  const classMidtermLookup = new Map<string, Map<number, StudentScoreRecord>>();
  classMidtermRecords.forEach((record) => {
    const subjectKey = record.subject.toLowerCase();
    if (!classMidtermLookup.has(subjectKey)) {
      classMidtermLookup.set(subjectKey, new Map());
    }
    classMidtermLookup.get(subjectKey)?.set(record.studentId, record);
  });

  const subjectTotalsByStudent: SubjectTotals = new Map();
  const subjectRankData = new Map<string, Array<{ studentId: number; termTotal: number }>>();

  classFinalRecords.forEach((record) => {
    const subjectKey = record.subject.toLowerCase();
    const relatedMidterm = classMidtermLookup.get(subjectKey)?.get(record.studentId) ?? null;

    const breakdown = computeSubjectBreakdown(record, relatedMidterm);
    const totals = subjectTotalsByStudent.get(record.studentId) ?? 0;
    subjectTotalsByStudent.set(record.studentId, totals + breakdown.termTotal);

    if (!subjectRankData.has(subjectKey)) {
      subjectRankData.set(subjectKey, []);
    }
    subjectRankData.get(subjectKey)?.push({
      studentId: record.studentId,
      termTotal: breakdown.termTotal,
    });
  });

  const subjectRankings = assignSubjectPositions(subjectRankData);
  const classPositions = computeClassPositions(subjectTotalsByStudent);

  const subjects: SubjectBreakdown[] = finalRecords
    .map((record) => {
      const subjectKey = record.subject.toLowerCase();
      const midterm = midtermLookup.get(subjectKey) ?? null;
      const breakdown = computeSubjectBreakdown(record, midterm);
      const grade = getGradeForScore(breakdown.termTotal);
      const position = subjectRankings.get(subjectKey)?.get(record.studentId) ?? null;

      return {
        subject: record.subject,
        ca1: breakdown.ca1,
        ca2: breakdown.ca2,
        exam: breakdown.exam,
        termTotal: breakdown.termTotal,
        grade: grade.grade,
        remark: grade.remark,
        position,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const analysis = analyseSubjects(subjects);
  const classPosition =
    classPositions.get(student.id) ?? null;

  const attendance = await computeAttendance(
    student.id,
    session.startDate,
    session.endDate,
  );

  const traitsRaw = await prisma.studentTrait.findMany({
    where: {
      studentId: student.studentCode,
      session: sessionId,
      term,
    },
    orderBy: [{ category: "asc" }, { trait: "asc" }],
  });

  const traits = groupTraits(
    traitsRaw.map((entry) => ({
      category: entry.category as "psychomotor" | "affective",
      trait: entry.trait,
      score: entry.score,
    })),
  );

  return {
    school: {
      id: student.school.id,
      name: student.school.name,
      address: student.school.address,
      city: student.school.city,
      state: student.school.state,
      country: student.school.country,
      phone: student.school.phone,
      email: student.school.email,
      principal: student.school.principal,
      logo: student.school.logo ?? null,
    },
    session: {
      id: session.id,
      name: session.name,
      term,
      startDate: session.startDate?.toISOString() ?? null,
      endDate: session.endDate?.toISOString() ?? null,
    },
    student: {
      id: student.id,
      code: student.studentCode,
      name: student.name,
      gender: null,
      classId: student.classId ?? null,
      className: student.className ?? student.class?.name ?? null,
      age: computeAge(student.dateOfBirth ?? null, session.endDate ?? null),
      bestSubject: analysis.bestSubject,
      weakestSubject: analysis.weakestSubject,
    },
    summaries: {
      totalScore: analysis.totalScore,
      averageScore: analysis.averageScore,
      classPosition,
      totalSubjects: analysis.totalSubjects,
      totalPossible: analysis.totalSubjects * 100,
      attendance,
    },
    classTeacher: {
      name: student.class?.formTeacher?.fullName ?? null,
    },
    subjects,
    traits,
  };
}
