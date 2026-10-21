-- Stock ledger for the owner area. Idempotent on purpose so re-running
-- stays safe even if parts of it were applied before.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- Patch a legacy variation of the table so it matches the schema.
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'IN';
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "unitCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_productId_fkey'
    ) THEN
        ALTER TABLE "StockMovement"
            ADD CONSTRAINT "StockMovement_productId_fkey"
            FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
