-- Satuan (unit) produk — tabel master yang dikelola penjual, mengikuti
-- pola Category: dipilih dari dropdown, bisa dibuat baru dari form.
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- Unik per nama, sama seperti Category.
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- Satuan umum warung supaya dropdown langsung terisi. Idempoten.
INSERT INTO "Unit" ("id", "name") VALUES
    (gen_random_uuid(), 'pcs'),
    (gen_random_uuid(), 'box'),
    (gen_random_uuid(), 'botol'),
    (gen_random_uuid(), 'sachet'),
    (gen_random_uuid(), 'gram'),
    (gen_random_uuid(), 'kg'),
    (gen_random_uuid(), 'liter'),
    (gen_random_uuid(), 'ml'),
    (gen_random_uuid(), 'lusin'),
    (gen_random_uuid(), 'pak'),
    (gen_random_uuid(), 'ikat'),
    (gen_random_uuid(), 'porsi')
ON CONFLICT ("name") DO NOTHING;
