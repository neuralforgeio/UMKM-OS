-- Handover v2: bukti serah terima anti-fraud
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverStatus" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverConfirmedBy" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_handoverCode_key"
  ON "Transaction"("handoverCode");

CREATE TABLE IF NOT EXISTS "HandoverEvent" (
  "id"            TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "method"        TEXT,
  "actorRole"     TEXT,
  "actorId"       TEXT,
  "buyerName"     TEXT,
  "signatureData" TEXT,
  "note"          TEXT,
  "userAgent"     TEXT,
  "ip"            TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HandoverEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HandoverEvent_transactionId_createdAt_idx"
  ON "HandoverEvent"("transactionId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HandoverEvent_transactionId_fkey') THEN
    ALTER TABLE "HandoverEvent"
      ADD CONSTRAINT "HandoverEvent_transactionId_fkey"
      FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
 $$;
