// Demo dataset for the UMKM OS warung scenario.
// Idempotent guard: when the database already holds products, the seed
// skips itself so re-deploys never wipe photos, restocks, and real
// sales the owner has recorded. Set FORCE_SEED=1 to wipe and rebuild
// the deterministic dataset (fixed RNG seed) from scratch.
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";

// Load .env first (Prisma CLI convention), then .env.local (what Next.js
// reads in local dev). dotenv never overrides variables that are already
// set, so an explicit $env:DATABASE_URL from the shell always wins.
config();
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Isi di frontend/.env (atau .env.local) — " +
      "contoh format: postgresql://umkm:PASSWORD_ANDA@localhost:5432/umkmos.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Deterministic PRNG (mulberry32) - same seed, same demo data.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261021);
const randInt = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const pick = <T>(values: T[]): T => values[Math.floor(rand() * values.length)];

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

type PaymentMethod = "CASH" | "QRIS" | "DEBIT";

function pickPayment(): PaymentMethod {
  const r = rand();
  if (r < 0.55) return "CASH";
  if (r < 0.9) return "QRIS";
  return "DEBIT";
}

// Six full weeks of history so the weekday forecast always has
// its maximum of 4 same-weekday samples.
const HISTORY_DAYS = 42;

// Receipts per weekday, index 0 = Sunday (warung pattern: weekend rush).
const WEEKDAY_BASE = [15, 9, 8, 10, 10, 12, 20];

const ITEM_COUNTS = [2, 2, 2, 3, 3, 3, 4];
const QUANTITIES = [1, 1, 1, 1, 2, 2, 3];
const NOTES = ["langganan", "ambil sendiri", "antar tetangga"];

const OUTLET = {
  name: "Warung Bu Sari",
  address: "Jl. Merdeka No. 12, Bandung",
  phone: "0812-3456-7890",
};

// Password demo TIDAK ditulis di kode (repo publik): ambil dari env
// SEED_OWNER_PASSWORD / SEED_KASIR_PASSWORD; bila kosong, dibuat acak
// dan dicetak sekali di akhir seed supaya tetap bisa dipakai.
const USERS = [
  {
    name: "Bu Sari",
    email: "busari@warung.id",
    password: process.env.SEED_OWNER_PASSWORD || randomBytes(8).toString("hex"),
    role: "OWNER" as const,
  },
  {
    name: "Rizky Pratama",
    email: "rizky@warung.id",
    password: process.env.SEED_KASIR_PASSWORD || randomBytes(8).toString("hex"),
    role: "KASIR" as const,
  },
];

const CATEGORY_NAMES = ["Minuman", "Makanan", "Sembako", "Snack", "Perawatan"];

type ProductDef = {
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  unit: string;
  minStock?: number;
  stock?: number;
};

// Three products are intentionally below their minimum stock so the
// restock widget on the owner dashboard has something to show.
const PRODUCT_DEFS: ProductDef[] = [
  {
    sku: "WBS-001",
    name: "Aqua 600ml",
    category: "Minuman",
    price: 4000,
    cost: 3200,
    unit: "btl",
    stock: 2,
  },
  {
    sku: "WBS-002",
    name: "Teh Pucuk Harum 350ml",
    category: "Minuman",
    price: 5000,
    cost: 4200,
    unit: "btl",
  },
  {
    sku: "WBS-003",
    name: "Kopi Kapal Api 15g",
    category: "Minuman",
    price: 2000,
    cost: 1600,
    unit: "sachet",
  },
  {
    sku: "WBS-004",
    name: "Ultra Milk Full Cream 250ml",
    category: "Minuman",
    price: 7000,
    cost: 6200,
    unit: "btl",
  },
  {
    sku: "WBS-005",
    name: "Indomie Goreng",
    category: "Makanan",
    price: 3500,
    cost: 3000,
    unit: "pcs",
    stock: 3,
  },
  {
    sku: "WBS-006",
    name: "Indomie Kari Ayam",
    category: "Makanan",
    price: 3500,
    cost: 3000,
    unit: "pcs",
  },
  {
    sku: "WBS-007",
    name: "Roti Sobek Coklat",
    category: "Makanan",
    price: 12000,
    cost: 10500,
    unit: "bks",
  },
  {
    sku: "WBS-008",
    name: "Sarden ABC 155g",
    category: "Makanan",
    price: 12000,
    cost: 10800,
    unit: "kaleng",
  },
  {
    sku: "WBS-009",
    name: "Beras Pandan Wangi 5kg",
    category: "Sembako",
    price: 68000,
    cost: 63000,
    unit: "bks",
    minStock: 8,
    stock: 4,
  },
  {
    sku: "WBS-010",
    name: "Minyak Goreng Bimoli 1L",
    category: "Sembako",
    price: 18500,
    cost: 17000,
    unit: "btl",
  },
  {
    sku: "WBS-011",
    name: "Gula Pasir 1kg",
    category: "Sembako",
    price: 16000,
    cost: 14500,
    unit: "kg",
  },
  {
    sku: "WBS-012",
    name: "Tepung Terigu 1kg",
    category: "Sembako",
    price: 13000,
    cost: 11800,
    unit: "bks",
  },
  {
    sku: "WBS-013",
    name: "Telur Ayam 1kg",
    category: "Sembako",
    price: 30000,
    cost: 27500,
    unit: "kg",
  },
  {
    sku: "WBS-014",
    name: "Chitato Sapi Panggang 68g",
    category: "Snack",
    price: 9000,
    cost: 8000,
    unit: "bks",
  },
  {
    sku: "WBS-015",
    name: "Oreo Original 133g",
    category: "Snack",
    price: 8500,
    cost: 7500,
    unit: "bks",
  },
  {
    sku: "WBS-016",
    name: "Beng Beng 20g",
    category: "Snack",
    price: 2500,
    cost: 2000,
    unit: "pcs",
  },
  {
    sku: "WBS-017",
    name: "Sabun Lifebuoy 110g",
    category: "Perawatan",
    price: 4500,
    cost: 3900,
    unit: "btl",
  },
  {
    sku: "WBS-018",
    name: "Shampo Clear Sachet 12ml",
    category: "Perawatan",
    price: 1500,
    cost: 1200,
    unit: "sachet",
  },
  {
    sku: "WBS-019",
    name: "Pasta Gigi Pepsodent 190g",
    category: "Perawatan",
    price: 14000,
    cost: 12600,
    unit: "bks",
  },
  {
    sku: "WBS-020",
    name: "Tisu Paseo 250 Sheet",
    category: "Perawatan",
    price: 8000,
    cost: 7100,
    unit: "bks",
  },
];

interface ItemPlan {
  productId: string;
  quantity: number;
  priceAtSale: number;
  subtotal: number;
}

interface TrxPlan {
  code: string;
  createdAt: Date;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  note: string | null;
  items: ItemPlan[];
}

function buildPlans(catalog: { id: string; price: number }[]): TrxPlan[] {
  const plans: TrxPlan[] = [];

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - back);
    const stamp = day.toISOString().slice(0, 10).replace(/-/g, "");
    const count = WEEKDAY_BASE[day.getUTCDay()] + randInt(0, 3);

    for (let i = 0; i < count; i++) {
      // Hours 1..13 UTC = 08:00..20:59 WIB, so every timestamp lands on
      // the same calendar day whether the reader works in UTC or WIB.
      const createdAt = new Date(day);
      createdAt.setUTCHours(randInt(1, 13), randInt(0, 59), randInt(0, 59), 0);

      const lineCount = pick(ITEM_COUNTS);
      const items: ItemPlan[] = [];
      const used = new Set<string>();
      while (items.length < lineCount) {
        const product = pick(catalog);
        if (used.has(product.id)) continue;
        used.add(product.id);
        const quantity = pick(QUANTITIES);
        items.push({
          productId: product.id,
          quantity,
          priceAtSale: product.price,
          subtotal: quantity * product.price,
        });
      }

      const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0);
      const discount = rand() < 0.12 ? randInt(1, 5) * 500 : 0;
      const total = subtotal - discount;
      const paymentMethod = pickPayment();
      const paidAmount =
        paymentMethod === "CASH" ? roundUpTo(total, 500) : total;
      const changeAmount = paidAmount - total;
      const note = rand() < 0.08 ? pick(NOTES) : null;

      plans.push({
        code: `TRX-${stamp}-${String(i + 1).padStart(4, "0")}`,
        createdAt,
        paymentMethod,
        subtotal,
        discount,
        total,
        paidAmount,
        changeAmount,
        note,
        items,
      });
    }
  }
  return plans;
}

// Akun developer bootstrap (Task 34, Fase A). Kredensial TIDAK pernah
// ditulis di kode: DEV_SEED_EMAIL / DEV_SEED_PASSWORD datang dari root
// .env (ter-gitignore) dan diteruskan compose ke service migrate.
// Create-if-missing: password hanya dipakai saat pembuatan pertama —
// selanjutnya ganti password lewat konsol developer (Fase B).
async function seedDeveloperAccount() {
  const devEmail = process.env.DEV_SEED_EMAIL?.trim().toLowerCase();
  const devPassword = process.env.DEV_SEED_PASSWORD;
  if (!devEmail || !devPassword) {
    console.log(
      "[seed] DEV_SEED_EMAIL/DEV_SEED_PASSWORD belum diisi — akun developer dilewati",
    );
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: devEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Developer",
        email: devEmail,
        password: await bcrypt.hash(devPassword, 10),
        role: "DEVELOPER",
        outletId: null,
      },
    });
    console.log(`[seed] akun developer dibuat: ${devEmail}`);
  } else if (
    existing.role !== "DEVELOPER" ||
    !existing.isActive ||
    existing.deletedAt
  ) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "DEVELOPER", isActive: true, deletedAt: null },
    });
    console.log(`[seed] akun dipulihkan sebagai developer: ${devEmail}`);
  } else {
    console.log(`[seed] akun developer sudah ada: ${devEmail}`);
  }
}

async function main() {
  // "docker compose up --build migrate" runs this seed after every
  // migration. Without the guard, that would wipe the ProductImage rows
  // (uploaded photos) and every StockMovement the owner just created.
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0 && process.env.FORCE_SEED !== "1") {
    console.log(
      `[seed] skipped: ${existingProducts} products already exist (data preserved)`,
    );
    console.log("[seed] set FORCE_SEED=1 to wipe and rebuild the demo dataset");
    await seedDeveloperAccount();
    return;
  }

  console.log("[seed] clearing existing demo data");
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(), // Cascades cover it, explicit for clarity
    prisma.transaction.deleteMany(), // TransactionItem cascades with it
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.outlet.deleteMany(),
  ]);
  await seedDeveloperAccount();

  const outlet = await prisma.outlet.create({ data: { ...OUTLET } });
  console.log(`[seed] outlet: ${outlet.name}`);

  const users = await Promise.all(
    USERS.map(async (u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: await bcrypt.hash(u.password, 10),
          role: u.role,
          outletId: outlet.id,
        },
      }),
    ),
  );
  const kasir = users[1];

  const categories = await Promise.all(
    CATEGORY_NAMES.map((name) => prisma.category.create({ data: { name } })),
  );
  const categoryId = new Map(categories.map((c) => [c.name, c.id]));

  const products = await Promise.all(
    PRODUCT_DEFS.map((p) =>
      prisma.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          categoryId: categoryId.get(p.category),
          outletId: outlet.id,
          price: p.price,
          cost: p.cost,
          stock: p.stock ?? randInt(8, 45),
          minStock: p.minStock ?? 5,
          unit: p.unit,
        },
      }),
    ),
  );
  const catalog = products.map((p) => ({ id: p.id, price: Number(p.price) }));
  console.log(
    `[seed] ${users.length} users, ${products.length} products, ${categories.length} categories`,
  );

  const plans = buildPlans(catalog);
  console.log(
    `[seed] generated ${plans.length} transaction plans over ${HISTORY_DAYS} days`,
  );

  const CHUNK = 25;
  // One SALE movement per receipt line, collected while the receipts are
  // created so the stock ledger matches the generated sales exactly.
  const saleMovements: {
    productId: string;
    type: "SALE";
    quantity: number;
    userId: string;
    transactionId: string;
    createdAt: Date;
  }[] = [];
  for (let i = 0; i < plans.length; i += CHUNK) {
    const chunk = plans.slice(i, i + CHUNK);
    const createdChunk = await Promise.all(
      chunk.map((t) =>
        prisma.transaction.create({
          data: {
            code: t.code,
            outletId: outlet.id,
            cashierId: kasir.id,
            paymentMethod: t.paymentMethod,
            status: "COMPLETED",
            subtotal: t.subtotal,
            discount: t.discount,
            total: t.total,
            paidAmount: t.paidAmount,
            changeAmount: t.changeAmount,
            note: t.note,
            createdAt: t.createdAt,
            items: { create: t.items },
          },
        }),
      ),
    );
    createdChunk.forEach((created, index) => {
      for (const item of chunk[index].items) {
        saleMovements.push({
          productId: item.productId,
          type: "SALE",
          quantity: item.quantity,
          userId: kasir.id,
          transactionId: created.id,
          createdAt: chunk[index].createdAt,
        });
      }
    });
    console.log(
      `[seed] transactions ${Math.min(i + CHUNK, plans.length)}/${plans.length}`,
    );
  }

  // Stock ledger: one opening IN balance per product, dated before the
  // oldest receipt, sized so the ledger reconciles with current stock
  // (opening + restocks - sales = stock now) from day one.
  const soldByProduct = new Map<string, number>();
  for (const movement of saleMovements) {
    soldByProduct.set(
      movement.productId,
      (soldByProduct.get(movement.productId) ?? 0) + movement.quantity,
    );
  }
  const openingAt = new Date();
  openingAt.setUTCDate(openingAt.getUTCDate() - (HISTORY_DAYS + 1));
  openingAt.setUTCHours(0, 0, 0, 0);

  const openingMovements = products.map((p) => ({
    productId: p.id,
    type: "IN" as const,
    quantity: p.stock + (soldByProduct.get(p.id) ?? 0),
    unitCost: p.cost,
    note: "Stok awal",
    createdAt: openingAt,
  }));

  await prisma.stockMovement.createMany({
    data: [...openingMovements, ...saleMovements],
  });
  console.log(
    `[seed] ${openingMovements.length + saleMovements.length} stock movements (opening balances + sales)`,
  );

  const summary = await prisma.transaction.aggregate({
    _count: { _all: true },
    _sum: { total: true },
  });
  const revenue = Number(summary._sum.total ?? 0);
  console.log(
    `[seed] done: revenue total Rp ${revenue.toLocaleString("id-ID")}`,
  );
  console.log("[seed] demo logins (password dari SEED_OWNER_PASSWORD /");
  console.log(
    "  SEED_KASIR_PASSWORD di .env — acak bila kosong, dicetak sekali):",
  );
  console.log(`  owner : ${USERS[0].email} / ${USERS[0].password}`);
  console.log(`  kasir : ${USERS[1].email} / ${USERS[1].password}`);
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
