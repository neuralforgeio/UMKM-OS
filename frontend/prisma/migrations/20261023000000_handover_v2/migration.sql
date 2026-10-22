-- Handover v2: bukti serah terima anti-fraud.
-- Kolom v1 (claimedAt/claimNote/claimAttempts) tidak dipakai lagi.
-- claimCode dipertahankan sebagai kode verifikasi 8 karakter.

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "claimCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverStatus" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "handoverConfirmedBy" TEXT;

ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "claimedAt";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "claimNote";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "claimAttempts";

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_claimCode_key"
  ON "Transaction"("claimCode");

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
