// =====================================================================
// UMKM OS — database seed: Bu Sari's warung + 60 days of sales history
// ---------------------------------------------------------------------
// Run (from frontend/):
//     npx tsx prisma/seed.ts
//
// Why fake history? The ML forecasting service needs 60-90 days of
// sales data to train on. Real data will accumulate once the POS goes
// live; this seed gives the models signal to learn from day one.
//
// Patterns baked in ON PURPOSE (so forecasting has something to find):
//   - weekend uplift (+40% receipts vs weekdays)
//   - payday boost (+20% from the 25th to the 5th)
//   - two products left BELOW minStock — to demo the restock alert
// =====================================================================

import { PrismaClient, PaymentMethod, Product } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------
// Deterministic PRNG (mulberry32): same seed -> same dataset every run,
// which makes bugs reproducible. Never use Math.random() in seeds.
// ---------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261020);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];

// ---------------------------------------------------------------------
// Domain data (whole rupiah — Decimal(12,2) columns, no cents)
// ---------------------------------------------------------------------
type ProductDef = { sku: string; name: string; category: string; price: number; cost: number };

const PRODUCT_DEFS: ProductDef[] = [
  { sku: "SKU-001", name: "Beras Premium 5kg", category: "Sembako", price: 68000, cost: 60000 },
  { sku: "SKU-002", name: "Minyak Goreng 1L", category: "Sembako", price: 17500, cost: 15000 },
  { sku: "SKU-003", name: "Gula Pasir 1kg", category: "Sembako", price: 16000, cost: 14000 },
  { sku: "SKU-004", name: "Telur Ayam 1kg", category: "Sembako", price: 28000, cost: 25000 },
  { sku: "SKU-005", name: "Tepung Terigu 1kg", category: "Sembako", price: 13000, cost: 11000 },
  { sku: "SKU-006", name: "Mie Instan", category: "Sembako", price: 3500, cost: 2800 },
  { sku: "SKU-007", name: "Kopi Sachet", category: "Minuman", price: 2000, cost: 1500 },
  { sku: "SKU-008", name: "Teh Celup 25s", category: "Minuman", price: 10000, cost: 8000 },
  { sku: "SKU-009", name: "Air Mineral 600ml", category: "Minuman", price: 4000, cost: 2500 },
  { sku: "SKU-010", name: "Susu UHT 1L", category: "Minuman", price: 19000, cost: 16000 },
  { sku: "SKU-011", name: "Biskuit Kelapa", category: "Snack", price: 8500, cost: 7000 },
  { sku: "SKU-012", name: "Wafer Cokelat", category: "Snack", price: 9000, cost: 7500 },
  { sku: "SKU-013", name: "Keripik Pisang", category: "Snack", price: 12000, cost: 9000 },
  { sku: "SKU-014", name: "Sabun Mandi", category: "Kebutuhan Rumah", price: 5500, cost: 4000 },
  { sku: "SKU-015", name: "Deterjen 800g", category: "Kebutuhan Rumah", price: 21000, cost: 18000 },
];

// Products deliberately left under minStock — to demo the restock flow.
const LOW_STOCK_SKUS = ["SKU-002", "SKU-009"];

const ymd = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

async function main(): Promise<void> {
  console.log("Seeding UMKM OS ...");

  // -- wipe (FK-safe order); makes the seed re-runnable in dev --
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.outlet.deleteMany();

  // -- outlet --
  const outlet = await prisma.outlet.create({
    data: {
      name: "Warung Bu Sari",
      address: "Jl. Melati No. 12, Sukamaju",
      phone: "0812-3456-7890",
    },
  });

  // -- users: passwords are bcrypt-hashed, never stored in plain text --
  const ownerHash = await bcrypt.hash("sari12345", 10);
  const kasirHash = await bcrypt.hash("kasir12345", 10);
  await prisma.user.create({
    data: { name: "Bu Sari", email: "sari@warung.id", password: ownerHash, role: "OWNER" },
  });
  const cashiers = await Promise.all(
    ["Dewi", "Rizky"].map((name) =>
      prisma.user.create({
        data: {
          name,
          email: `${name.toLowerCase()}@warung.id`,
          password: kasirHash,
          role: "KASIR",
          outletId: outlet.id,
        },
      })
    )
  );

  // -- categories --
  const categories: Record<string, string> = {};
  for (const name of ["Sembako", "Minuman", "Snack", "Kebutuhan Rumah"]) {
    categories[name] = (await prisma.category.create({ data: { name } })).id;
  }

  // -- products --
  const products: Product[] = [];
  for (const def of PRODUCT_DEFS) {
    products.push(
      await prisma.product.create({
        data: {
          sku: def.sku,
          name: def.name,
          price: def.price,
          cost: def.cost,
          categoryId: categories[def.category],
          outletId: outlet.id,
          minStock: randInt(4, 8),
        },
      })
    );
  }

  // -- 60 days of sales history (ends yesterday; today stays clean) --
  const DAYS = 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const transactions: {
    id: string; code: string; outletId: string; cashierId: string;
    paymentMethod: PaymentMethod; status: "COMPLETED";
    subtotal: number; discount: number; total: number;
    paidAmount: number; changeAmount: number; createdAt: Date;
  }[] = [];
  const items: {
    id: string; transactionId: string; productId: string;
    quantity: number; priceAtSale: number; subtotal: number;
  }[] = [];

  for (let d = DAYS; d >= 1; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    const isWeekend = day.getDay() === 0 || day.getDay() === 6; // 0=Sun, 6=Sat
    const isPayday = day.getDate() >= 25 || day.getDate() <= 5;

    let receiptCount = randInt(8, 14); // weekday baseline
    if (isWeekend) receiptCount = Math.round(receiptCount * 1.4);
    if (isPayday) receiptCount = Math.round(receiptCount * 1.2);

    for (let t = 1; t <= receiptCount; t++) {
      const createdAt = new Date(day);
      createdAt.setHours(randInt(8, 19), randInt(0, 59), randInt(0, 59)); // 08:00-19:59

      // 1-5 distinct products, 1-3 units each
      const itemCount = randInt(1, 5);
      const chosen = new Map<string, number>();
      while (chosen.size < itemCount) {
        const product = pick(products);
        if (!chosen.has(product.id)) chosen.set(product.id, randInt(1, 3));
      }

      let subtotal = 0;
      const lines = [...chosen.entries()].map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId)!;
        const lineTotal = product.price.toNumber() * quantity;
        subtotal += lineTotal;
        return { productId, quantity, priceAtSale: product.price.toNumber(), subtotal: lineTotal };
      });

      const discount = rand() < 0.1 ? Math.round((subtotal * 0.05) / 500) * 500 : 0; // rare 5% promo
      const total = subtotal - discount;

      const roll = rand(); // CASH 60% | QRIS 30% | DEBIT 10%
      const paymentMethod: PaymentMethod = roll < 0.6 ? "CASH" : roll < 0.9 ? "QRIS" : "DEBIT";
      // Cash-paying customers round up to the nearest Rp1.000
      const paidAmount = paymentMethod === "CASH" ? Math.ceil(total / 1000) * 1000 : total;
      const changeAmount = paidAmount - total;

      const id = crypto.randomUUID();
      transactions.push({
        id,
        code: `TRX-${ymd(day)}-${String(t).padStart(4, "0")}`,
        outletId: outlet.id,
        cashierId: pick(cashiers).id,
        paymentMethod,
        status: "COMPLETED",
        subtotal,
        discount,
        total,
        paidAmount,
        changeAmount,
        createdAt,
      });
      for (const line of lines) {
        items.push({ id: crypto.randomUUID(), transactionId: id, ...line });
      }
    }
  }

  // Two bulk inserts instead of ~2.000 individual round trips
  await prisma.transaction.createMany({ data: transactions });
  await prisma.transactionItem.createMany({ data: items });

  // -- final stock: plausible remaining amounts (the audit-trail stock
  //    movements arrive with the inventory feature in a later session)
  for (const product of products) {
    const low = LOW_STOCK_SKUS.includes(product.sku);
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: low ? randInt(1, 3) : randInt(15, 90) },
    });
  }

  console.log(
    `Done: ${products.length} products, ${transactions.length} transactions, ${items.length} items over ${DAYS} days.`
  );
  console.log("Logins -> owner: sari@warung.id / sari12345 | kasir: dewi@warung.id / kasir12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
