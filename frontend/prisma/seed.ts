// Demo dataset for the UMKM OS warung scenario.
// Safe to re-run: wipes all business tables first, then rebuilds
// everything deterministically (fixed RNG seed) so every re-seed
// produces identical numbers.

import { config } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"
import { PrismaClient } from "../lib/generated/prisma/client"

// Load .env first (Prisma CLI convention), then .env.local (what Next.js
// reads in local dev). dotenv never overrides variables that are already
// set, so an explicit $env:DATABASE_URL from the shell always wins.
config()
config({ path: ".env.local" })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. For the docker demo db use: " +
      '$env:DATABASE_URL = "postgresql://umkm:umkmindo45@localhost:5433/umkmos" ' +
      "(docker, port 5433) or frontend/.env.local (local dev, port 5432).",
  )
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

// Deterministic PRNG (mulberry32) - same seed, same demo data.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261021)
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const pick = <T>(values: T[]): T => values[Math.floor(rand() * values.length)]

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

type PaymentMethod = "CASH" | "QRIS" | "DEBIT"

function pickPayment(): PaymentMethod {
  const r = rand()
  if (r < 0.55) return "CASH"
  if (r < 0.9) return "QRIS"
  return "DEBIT"
}

// Six full weeks of history so the weekday forecast always has
// its maximum of 4 same-weekday samples.
const HISTORY_DAYS = 42

// Receipts per weekday, index 0 = Sunday (warung pattern: weekend rush).
const WEEKDAY_BASE = [15, 9, 8, 10, 10, 12, 20]

const ITEM_COUNTS = [2, 2, 2, 3, 3, 3, 4]
const QUANTITIES = [1, 1, 1, 1, 2, 2, 3]
const NOTES = ["langganan", "ambil sendiri", "antar tetangga"]

const OUTLET = {
  name: "Warung Bu Sari",
  address: "Jl. Merdeka No. 12, Bandung",
  phone: "0812-3456-7890",
}

const USERS = [
  { name: "Bu Sari", email: "busari@warung.id", password: "owner12345", role: "OWNER" as const },
  { name: "Rizky Pratama", email: "rizky@warung.id", password: "kasir12345", role: "KASIR" as const },
]

const CATEGORY_NAMES = ["Minuman", "Makanan", "Sembako", "Snack", "Perawatan"]

type ProductDef = {
  sku: string
  name: string
  category: string
  price: number
  cost: number
  unit: string
  minStock?: number
  stock?: number
}

// Three products are intentionally below their minimum stock so the
// restock widget on the owner dashboard has something to show.
const PRODUCT_DEFS: ProductDef[] = [
  { sku: "WBS-001", name: "Aqua 600ml", category: "Minuman", price: 4000, cost: 3200, unit: "btl", stock: 2 },
  { sku: "WBS-002", name: "Teh Pucuk Harum 350ml", category: "Minuman", price: 5000, cost: 4200, unit: "btl" },
  { sku: "WBS-003", name: "Kopi Kapal Api 15g", category: "Minuman", price: 2000, cost: 1600, unit: "sachet" },
  { sku: "WBS-004", name: "Ultra Milk Full Cream 250ml", category: "Minuman", price: 7000, cost: 6200, unit: "btl" },
  { sku: "WBS-005", name: "Indomie Goreng", category: "Makanan", price: 3500, cost: 3000, unit: "pcs", stock: 3 },
  { sku: "WBS-006", name: "Indomie Kari Ayam", category: "Makanan", price: 3500, cost: 3000, unit: "pcs" },
  { sku: "WBS-007", name: "Roti Sobek Coklat", category: "Makanan", price: 12000, cost: 10500, unit: "bks" },
  { sku: "WBS-008", name: "Sarden ABC 155g", category: "Makanan", price: 12000, cost: 10800, unit: "kaleng" },
  { sku: "WBS-009", name: "Beras Pandan Wangi 5kg", category: "Sembako", price: 68000, cost: 63000, unit: "bks", minStock: 8, stock: 4 },
  { sku: "WBS-010", name: "Minyak Goreng Bimoli 1L", category: "Sembako", price: 18500, cost: 17000, unit: "btl" },
  { sku: "WBS-011", name: "Gula Pasir 1kg", category: "Sembako", price: 16000, cost: 14500, unit: "kg" },
  { sku: "WBS-012", name: "Tepung Terigu 1kg", category: "Sembako", price: 13000, cost: 11800, unit: "bks" },
  { sku: "WBS-013", name: "Telur Ayam 1kg", category: "Sembako", price: 30000, cost: 27500, unit: "kg" },
  { sku: "WBS-014", name: "Chitato Sapi Panggang 68g", category: "Snack", price: 9000, cost: 8000, unit: "bks" },
  { sku: "WBS-015", name: "Oreo Original 133g", category: "Snack", price: 8500, cost: 7500, unit: "bks" },
  { sku: "WBS-016", name: "Beng Beng 20g", category: "Snack", price: 2500, cost: 2000, unit: "pcs" },
  { sku: "WBS-017", name: "Sabun Lifebuoy 110g", category: "Perawatan", price: 4500, cost: 3900, unit: "btl" },
  { sku: "WBS-018", name: "Shampo Clear Sachet 12ml", category: "Perawatan", price: 1500, cost: 1200, unit: "sachet" },
  { sku: "WBS-019", name: "Pasta Gigi Pepsodent 190g", category: "Perawatan", price: 14000, cost: 12600, unit: "bks" },
  { sku: "WBS-020", name: "Tisu Paseo 250 Sheet", category: "Perawatan", price: 8000, cost: 7100, unit: "bks" },
]

interface ItemPlan {
  productId: string
  quantity: number
  priceAtSale: number
  subtotal: number
}

interface TrxPlan {
  code: string
  createdAt: Date
  paymentMethod: PaymentMethod
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  changeAmount: number
  note: string | null
  items: ItemPlan[]
}

function buildPlans(catalog: { id: string; price: number }[]): TrxPlan[] {
  const plans: TrxPlan[] = []

  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - back)
    const stamp = day.toISOString().slice(0, 10).replace(/-/g, "")
    const count = WEEKDAY_BASE[day.getUTCDay()] + randInt(0, 3)

    for (let i = 0; i < count; i++) {
      // Hours 1..13 UTC = 08:00..20:59 WIB, so every timestamp lands on
      // the same calendar day whether the reader works in UTC or WIB.
      const createdAt = new Date(day)
      createdAt.setUTCHours(randInt(1, 13), randInt(0, 59), randInt(0, 59), 0)

      const lineCount = pick(ITEM_COUNTS)
      const items: ItemPlan[] = []
      const used = new Set<string>()
      while (items.length < lineCount) {
        const product = pick(catalog)
        if (used.has(product.id)) continue
        used.add(product.id)
        const quantity = pick(QUANTITIES)
        items.push({
          productId: product.id,
          quantity,
          priceAtSale: product.price,
          subtotal: quantity * product.price,
        })
      }

      const subtotal = items.reduce((sum, it) => sum + it.subtotal, 0)
      const discount = rand() < 0.12 ? randInt(1, 5) * 500 : 0
      const total = subtotal - discount
      const paymentMethod = pickPayment()
      const paidAmount = paymentMethod === "CASH" ? roundUpTo(total, 500) : total
      const changeAmount = paidAmount - total
      const note = rand() < 0.08 ? pick(NOTES) : null

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
      })
    }
  }
  return plans
}

async function main() {
  console.log("[seed] clearing existing demo data")
  await prisma.$transaction([
    prisma.transaction.deleteMany(), // TransactionItem cascades with it
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
    prisma.outlet.deleteMany(),
  ])

  const outlet = await prisma.outlet.create({ data: { ...OUTLET } })
  console.log(`[seed] outlet: ${outlet.name}`)

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
  )
  const kasir = users[1]

  const categories = await Promise.all(
    CATEGORY_NAMES.map((name) => prisma.category.create({ data: { name } })),
  )
  const categoryId = new Map(categories.map((c) => [c.name, c.id]))

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
  )
  const catalog = products.map((p) => ({ id: p.id, price: Number(p.price) }))
  console.log(`[seed] ${users.length} users, ${products.length} products, ${categories.length} categories`)

  const plans = buildPlans(catalog)
  console.log(`[seed] generated ${plans.length} transaction plans over ${HISTORY_DAYS} days`)

  const CHUNK = 25
  for (let i = 0; i < plans.length; i += CHUNK) {
    const chunk = plans.slice(i, i + CHUNK)
    await Promise.all(
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
    )
    console.log(`[seed] transactions ${Math.min(i + CHUNK, plans.length)}/${plans.length}`)
  }

  const summary = await prisma.transaction.aggregate({
    _count: { _all: true },
    _sum: { total: true },
  })
  const revenue = Number(summary._sum.total ?? 0)
  console.log(`[seed] done: revenue total Rp ${revenue.toLocaleString("id-ID")}`)
  console.log("[seed] demo logins:")
  console.log("  owner : busari@warung.id / owner12345")
  console.log("  kasir : rizky@warung.id / kasir12345")
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
