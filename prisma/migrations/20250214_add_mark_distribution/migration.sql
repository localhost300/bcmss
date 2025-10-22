-- CreateTable
CREATE TABLE "MarkDistribution" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "sessionId" TEXT NOT NULL,
    "term" "Term" NOT NULL,
    "examType" "ExamType" NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarkDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarkDistributionComponent" (
    "id" SERIAL NOT NULL,
    "distributionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarkDistributionComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarkDistribution_schoolId_sessionId_term_examType_key" ON "MarkDistribution"("schoolId", "sessionId", "term", "examType");

-- CreateIndex
CREATE INDEX "MarkDistributionComponent_distributionId_order_idx" ON "MarkDistributionComponent"("distributionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MarkDistributionComponent_distributionId_componentId_key" ON "MarkDistributionComponent"("distributionId", "componentId");

-- AddForeignKey
ALTER TABLE "MarkDistribution" ADD CONSTRAINT "MarkDistribution_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkDistribution" ADD CONSTRAINT "MarkDistribution_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkDistributionComponent" ADD CONSTRAINT "MarkDistributionComponent_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "MarkDistribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
