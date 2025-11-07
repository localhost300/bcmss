-- AlterTable
ALTER TABLE "ResultLock" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubjectClassTeacher" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AcademicTermSchedule" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTermSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcademicTermSchedule_sessionId_idx" ON "AcademicTermSchedule"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTermSchedule_sessionId_term_key" ON "AcademicTermSchedule"("sessionId", "term");

-- AddForeignKey
ALTER TABLE "AcademicTermSchedule" ADD CONSTRAINT "AcademicTermSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
