-- CreateTable
CREATE TABLE "StudentTrait" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "trait" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTrait_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTrait_studentId_term_session_idx" ON "StudentTrait"("studentId", "term", "session");

-- AddForeignKey
ALTER TABLE "StudentTrait" ADD CONSTRAINT "StudentTrait_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("studentCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTrait" ADD CONSTRAINT "StudentTrait_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
