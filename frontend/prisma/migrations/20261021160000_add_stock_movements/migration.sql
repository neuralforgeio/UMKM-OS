-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'SALE', 'ADJUST');

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "note" TEXT,
    "userId" TEXT,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill for existing databases: every completed sale line becomes a
-- SALE movement linked to its receipt, so the stock timeline is complete
-- from the very first transaction instead of starting empty. On a fresh
-- database this runs before the seed, so it is a no-op there (the seed
-- generates its own movements).
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "unitCost", "note", "userId", "transactionId", "createdAt")
SELECT gen_random_uuid(), "ti"."productId", 'SALE'::"StockMovementType", "ti"."quantity", NULL, NULL, "t"."cashierId", "t"."id", "t"."createdAt"
FROM "TransactionItem" AS "ti"
JOIN "Transaction" AS "t" ON "t"."id" = "ti"."transactionId"
WHERE "t"."status" = 'COMPLETED';

-- Backfill: one reconstructed opening balance (IN) per product so the
-- ledger reconciles: opening + restocks - sales = current stock. The
-- quantity is the current stock plus everything ever sold, dated one day
-- before the product's oldest receipt so it always sorts first.
INSERT INTO "StockMovement" ("id", "productId", "type", "quantity", "unitCost", "note", "userId", "transactionId", "createdAt")
SELECT gen_random_uuid(), "p"."id", 'IN'::"StockMovementType", "p"."stock" + COALESCE("sold"."qty", 0), "p"."cost", 'Stok awal (rekonstruksi)', NULL, NULL, COALESCE("first"."at", NOW()) - INTERVAL '1 day'
FROM "Product" AS "p"
LEFT JOIN (
    SELECT "ti"."productId" AS "productId", SUM("ti"."quantity") AS "qty"
    FROM "TransactionItem" AS "ti"
    JOIN "Transaction" AS "t" ON "t"."id" = "ti"."transactionId"
    WHERE "t"."status" = 'COMPLETED'
    GROUP BY "ti"."productId"
) AS "sold" ON "sold"."productId" = "p"."id"
LEFT JOIN (
    SELECT "ti"."productId" AS "productId", MIN("t"."createdAt") AS "at"
    FROM "TransactionItem" AS "ti"
    JOIN "Transaction" AS "t" ON "t"."id" = "ti"."transactionId"
    GROUP BY "ti"."productId"
) AS "first" ON "first"."productId" = "p"."id";
