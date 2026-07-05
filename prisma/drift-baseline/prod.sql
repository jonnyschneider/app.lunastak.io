-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "shareEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);
-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");
