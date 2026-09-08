-- AlterTable
ALTER TABLE "DecisionStackSnapshot" ADD COLUMN     "fragmentIds" JSONB;
-- AlterTable
ALTER TABLE "Fragment" ADD COLUMN     "interpretationType" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "fragmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceRole" TEXT,
    "verification" TEXT NOT NULL DEFAULT 'unverifiable',
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Evidence_fragmentId_idx" ON "Evidence"("fragmentId");
-- CreateIndex
CREATE INDEX "Evidence_verification_idx" ON "Evidence"("verification");
-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_fragmentId_fkey" FOREIGN KEY ("fragmentId") REFERENCES "Fragment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
