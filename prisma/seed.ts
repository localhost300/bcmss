import { PrismaClient, ExamType, StudentCategory, Term } from "@prisma/client";
const prisma = new PrismaClient();

async function resetDatabase() {
  await prisma.markDistributionComponent.deleteMany();
  await prisma.markDistribution.deleteMany();
  await prisma.studentScoreRecord.deleteMany();
  await prisma.studentAttendance.deleteMany();
  await prisma.studentMessage.deleteMany();
  await prisma.examScore.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.teacherClass.deleteMany();
  await prisma.subjectClass.deleteMany();
  await prisma.studentParent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.academicSessionOnSchool.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.academicSession.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await resetDatabase();

  const schools = await Promise.all([
    prisma.school.create({
      data: {
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
      },
    }),
    prisma.school.create({
      data: {
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
      },
    }),
  ]);
  const session = await prisma.academicSession.create({
    data: {
      id: "2024-2025",
      name: "2024/2025 Academic Session",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-15"),
      isCurrent: true,
    },
  });

  await prisma.academicSessionOnSchool.createMany({
    data: schools.map((school) => ({ sessionId: session.id, schoolId: school.id })),
  });

  const distributionTemplates = [
    {
      sessionId: session.id,
      term: Term.FIRST,
      examType: ExamType.MIDTERM,
      title: "Midterm Assessment – First Term",
      components: [
        { componentId: "ca1", label: "CA1", weight: 20, order: 0 },
        { componentId: "quiz", label: "Quiz", weight: 10, order: 1 },
        { componentId: "assignment", label: "Assignment", weight: 10, order: 2 },
        { componentId: "participation", label: "Class Participation", weight: 10, order: 3 },
      ],
    },
    {
      sessionId: session.id,
      term: Term.SECOND,
      examType: ExamType.MIDTERM,
      title: "Midterm Assessment – Second Term",
      components: [
        { componentId: "ca1", label: "CA1", weight: 20, order: 0 },
        { componentId: "quiz", label: "Quiz", weight: 10, order: 1 },
        { componentId: "assignment", label: "Assignment", weight: 10, order: 2 },
        { componentId: "participation", label: "Class Participation", weight: 10, order: 3 },
      ],
    },
    {
      sessionId: session.id,
      term: Term.THIRD,
      examType: ExamType.MIDTERM,
      title: "Midterm Assessment – Third Term",
      components: [
        { componentId: "ca1", label: "CA1", weight: 20, order: 0 },
        { componentId: "quiz", label: "Quiz", weight: 10, order: 1 },
        { componentId: "assignment", label: "Assignment", weight: 10, order: 2 },
        { componentId: "participation", label: "Class Participation", weight: 10, order: 3 },
      ],
    },
    {
      sessionId: session.id,
      term: Term.FIRST,
      examType: ExamType.FINAL,
      title: "Final Examination – First Term",
      components: [
        { componentId: "midtermCarry", label: "Midterm Aggregate (÷2.5)", weight: 20, order: 0 },
        { componentId: "ca2", label: "CA2", weight: 20, order: 1 },
        { componentId: "exam", label: "Examination", weight: 60, order: 2 },
      ],
    },
    {
      sessionId: session.id,
      term: Term.SECOND,
      examType: ExamType.FINAL,
      title: "Final Examination – Second Term",
      components: [
        { componentId: "midtermCarry", label: "Midterm Aggregate (÷2.5)", weight: 20, order: 0 },
        { componentId: "ca2", label: "CA2", weight: 20, order: 1 },
        { componentId: "exam", label: "Examination", weight: 60, order: 2 },
      ],
    },
    {
      sessionId: session.id,
      term: Term.THIRD,
      examType: ExamType.FINAL,
      title: "Final Examination – Third Term",
      components: [
        { componentId: "midtermCarry", label: "Midterm Aggregate (÷2.5)", weight: 20, order: 0 },
        { componentId: "ca2", label: "CA2", weight: 20, order: 1 },
        { componentId: "exam", label: "Examination", weight: 60, order: 2 },
      ],
    },
  ];

  for (const template of distributionTemplates) {
    await prisma.markDistribution.upsert({
      where: {
        schoolId_sessionId_term_examType: {
          schoolId: null,
          sessionId: template.sessionId,
          term: template.term,
          examType: template.examType,
        },
      },
      update: {
        title: template.title,
        components: {
          deleteMany: {},
          create: template.components,
        },
      },
      create: {
        schoolId: null,
        sessionId: template.sessionId,
        term: template.term,
        examType: template.examType,
        title: template.title,
        components: {
          create: template.components,
        },
      },
    });
  }

  const subjects = await Promise.all([
    prisma.subject.create({
      data: {
        name: "Mathematics",
        code: "MTH",
        schoolId: schools[0].id,
      },
    }),
    prisma.subject.create({
      data: {
        name: "English",
        code: "ENG",
        schoolId: schools[0].id,
      },
    }),
  ]);
  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        teacherCode: "T-1001",
        fullName: "Adaeze Nwosu",
        email: "adaeze.nwosu@bishopcrowther.sch.ng",
        phone: "+2348120000001",
        address: "12 Alloy Close",
        schoolId: schools[0].id,
      },
    }),
    prisma.teacher.create({
      data: {
        teacherCode: "T-1002",
        fullName: "Kunle Hassan",
        email: "kunle.hassan@bishopcrowther.sch.ng",
        phone: "+2348120000002",
        address: "24 Harbour Street",
        schoolId: schools[0].id,
      },
    }),
  ]);

  await prisma.teacherSubject.createMany({
    data: [
      { teacherId: teachers[0].id, subjectId: subjects[0].id },
      { teacherId: teachers[1].id, subjectId: subjects[1].id },
    ],
  });
  const classA = await prisma.schoolClass.create({
    data: {
      name: "JSS2A",
      code: "J2A",
      capacity: 30,
      category: "Junior Secondary",
      section: "Morning",
      room: "B12",
      supervisor: "Mrs. Amina Lawal",
      grade: "JSS2",
      schoolId: schools[0].id,
      formTeacherId: teachers[0].id,
    },
  });

  const classB = await prisma.schoolClass.create({
    data: {
      name: "JSS3B",
      code: "J3B",
      capacity: 30,
      category: "Junior Secondary",
      section: "Morning",
      room: "C06",
      supervisor: "Mr. Kayode Ola",
      grade: "JSS3",
      schoolId: schools[0].id,
      formTeacherId: teachers[1].id,
    },
  });

  await prisma.teacherClass.createMany({
    data: [
      { teacherId: teachers[0].id, classId: classA.id },
      { teacherId: teachers[1].id, classId: classB.id },
    ],
  });

  await prisma.subjectClass.createMany({
    data: [
      { subjectId: subjects[0].id, classId: classA.id },
      { subjectId: subjects[0].id, classId: classB.id },
      { subjectId: subjects[1].id, classId: classA.id },
      { subjectId: subjects[1].id, classId: classB.id },
    ],
  });
  const parents = await Promise.all([
    prisma.parent.create({
      data: {
        name: "Ifeoma Ude",
        email: "ifeoma.ude@example.com",
        phone: "+2348031000001",
        address: "18 Garden Close",
        schoolId: schools[0].id,
      },
    }),
    prisma.parent.create({
      data: {
        name: "Segun Bamidele",
        email: "segun.bamidele@example.com",
        phone: "+2348031000002",
        address: "45 Market Street",
        schoolId: schools[0].id,
      },
    }),
  ]);

  const students = await Promise.all([
    prisma.student.create({
      data: {
        studentCode: "STU-2001",
        name: "Chinedu Okafor",
        email: "chinedu.okafor@example.com",
        phone: "+2348052000001",
        address: "7 Palm Crescent",
        grade: 2,
        category: StudentCategory.SCIENCE,
        schoolId: schools[0].id,
        classId: classA.id,
        className: classA.name,
      },
    }),
    prisma.student.create({
      data: {
        studentCode: "STU-2002",
        name: "Bose Ajayi",
        email: "bose.ajayi@example.com",
        phone: "+2348052000002",
        address: "9 Creek Road",
        grade: 2,
        category: StudentCategory.ART,
        schoolId: schools[0].id,
        classId: classA.id,
        className: classA.name,
      },
    }),
    prisma.student.create({
      data: {
        studentCode: "STU-2003",
        name: "Gbenga Afolabi",
        email: "gbenga.afolabi@example.com",
        phone: "+2348052000003",
        address: "12 Queens Drive",
        grade: 3,
        category: StudentCategory.COMMERCIAL,
        schoolId: schools[0].id,
        classId: classB.id,
        className: classB.name,
      },
    }),
  ]);

  await prisma.studentParent.createMany({
    data: [
      { studentId: students[0].id, parentId: parents[0].id, relationship: "Mother" },
      { studentId: students[1].id, parentId: parents[0].id, relationship: "Mother" },
      { studentId: students[2].id, parentId: parents[1].id, relationship: "Father" },
    ],
  });
  await prisma.exam.createMany({
    data: [
      {
        name: "Midterm Assessment - Mathematics",
        examDate: new Date("2024-11-05"),
        startTime: "09:00",
        endTime: "10:30",
        examType: ExamType.MIDTERM,
        term: Term.FIRST,
        schoolId: schools[0].id,
        sessionId: session.id,
        classId: classA.id,
        subjectId: subjects[0].id,
      },
      {
        name: "Final Exam - Mathematics",
        examDate: new Date("2025-03-15"),
        startTime: "09:00",
        endTime: "11:30",
        examType: ExamType.FINAL,
        term: Term.SECOND,
        schoolId: schools[0].id,
        sessionId: session.id,
        classId: classA.id,
        subjectId: subjects[0].id,
      },
    ],
  });
  const buildComponents = (values: Array<{ id: string; label: string; score: number; max: number }>) =>
    values.map(({ id, label, score, max }) => ({
      componentId: id,
      label,
      score,
      maxScore: max,
    }));

  await prisma.studentScoreRecord.createMany({
    data: [
      {
        id: "record-chinedu-math-midterm",
        studentId: students[0].id,
        studentName: students[0].name,
        classId: String(classA.id),
        className: classA.name,
        subject: "Mathematics",
        examType: "midterm",
        term: "First Term",
        sessionId: session.id,
        components: buildComponents([
          { id: "ca1", label: "CA 1", score: 18, max: 20 },
          { id: "quiz", label: "Quiz", score: 8, max: 10 },
          { id: "assignment", label: "Assignment", score: 9, max: 10 },
          { id: "participation", label: "Participation", score: 7, max: 10 },
        ]),
        totalScore: 42,
        maxScore: 50,
        percentage: 84,
      },
      {
        id: "record-chinedu-math-final",
        studentId: students[0].id,
        studentName: students[0].name,
        classId: String(classA.id),
        className: classA.name,
        subject: "Mathematics",
        examType: "final",
        term: "Second Term",
        sessionId: session.id,
        components: buildComponents([
          { id: "ca1", label: "CA 1", score: 18, max: 20 },
          { id: "quiz", label: "Quiz", score: 8, max: 10 },
          { id: "assignment", label: "Assignment", score: 9, max: 10 },
          { id: "participation", label: "Participation", score: 7, max: 10 },
          { id: "ca2", label: "CA 2", score: 17, max: 20 },
          { id: "exam", label: "Exam", score: 55, max: 60 },
        ]),
        totalScore: 114,
        maxScore: 130,
        percentage: 87.7,
      },
      {
        id: "record-bose-math-midterm",
        studentId: students[1].id,
        studentName: students[1].name,
        classId: String(classA.id),
        className: classA.name,
        subject: "Mathematics",
        examType: "midterm",
        term: "First Term",
        sessionId: session.id,
        components: buildComponents([
          { id: "ca1", label: "CA 1", score: 14, max: 20 },
          { id: "quiz", label: "Quiz", score: 7, max: 10 },
          { id: "assignment", label: "Assignment", score: 8, max: 10 },
          { id: "participation", label: "Participation", score: 9, max: 10 },
        ]),
        totalScore: 38,
        maxScore: 50,
        percentage: 76,
      },
      {
        id: "record-bose-math-final",
        studentId: students[1].id,
        studentName: students[1].name,
        classId: String(classA.id),
        className: classA.name,
        subject: "Mathematics",
        examType: "final",
        term: "Second Term",
        sessionId: session.id,
        components: buildComponents([
          { id: "ca1", label: "CA 1", score: 14, max: 20 },
          { id: "quiz", label: "Quiz", score: 7, max: 10 },
          { id: "assignment", label: "Assignment", score: 8, max: 10 },
          { id: "participation", label: "Participation", score: 9, max: 10 },
          { id: "ca2", label: "CA 2", score: 16, max: 20 },
          { id: "exam", label: "Exam", score: 48, max: 60 },
        ]),
        totalScore: 102,
        maxScore: 130,
        percentage: 78.5,
      },
      {
        id: "record-gbenga-english-final",
        studentId: students[2].id,
        studentName: students[2].name,
        classId: String(classB.id),
        className: classB.name,
        subject: "English",
        examType: "final",
        term: "Second Term",
        sessionId: session.id,
        components: buildComponents([
          { id: "ca1", label: "CA 1", score: 16, max: 20 },
          { id: "quiz", label: "Quiz", score: 9, max: 10 },
          { id: "assignment", label: "Assignment", score: 9, max: 10 },
          { id: "participation", label: "Participation", score: 10, max: 10 },
          { id: "ca2", label: "CA 2", score: 18, max: 20 },
          { id: "exam", label: "Exam", score: 57, max: 60 },
        ]),
        totalScore: 119,
        maxScore: 130,
        percentage: 91.5,
      },
    ],
  });
  console.log("Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
