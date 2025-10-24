-- CreateTable
CREATE TABLE "ResultLock" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "examType" "ExamType" NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "allowedTeacherIds" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultLock_classId_sessionId_term_examType_key" ON "ResultLock"("classId", "sessionId", "term", "examType");

-- AddForeignKey
ALTER TABLE "ResultLock" ADD CONSTRAINT "ResultLock_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
