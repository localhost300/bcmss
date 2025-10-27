-- CreateTable
CREATE TABLE "SubjectClassTeacher" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectClassTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectClassTeacher_subjectId_classId_key" ON "SubjectClassTeacher"("subjectId", "classId");

-- CreateIndex
CREATE INDEX "SubjectClassTeacher_teacherId_idx" ON "SubjectClassTeacher"("teacherId");

-- CreateIndex
CREATE INDEX "SubjectClassTeacher_classId_idx" ON "SubjectClassTeacher"("classId");

-- AddForeignKey
ALTER TABLE "SubjectClassTeacher" ADD CONSTRAINT "SubjectClassTeacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectClassTeacher" ADD CONSTRAINT "SubjectClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectClassTeacher" ADD CONSTRAINT "SubjectClassTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
