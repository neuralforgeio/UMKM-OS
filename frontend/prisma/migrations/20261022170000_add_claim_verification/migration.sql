ALTER TABLE "Transaction" ADD COLUMN "claimCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "claimNote" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "claimAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Transaction_claimCode_key" ON "Transaction"("claimCode");
