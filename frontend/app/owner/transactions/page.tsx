import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext } from "@/lib/outlet-context";
import { userMenuUser } from "@/lib/session-user";
import { TransactionsClient } from "./transactions-client";
import type { ProfitSummary, TransactionRow } from "./types";

export const instant = false;

// Latest N receipts loaded for the history list — 200 covers roughly a
// busy fortnight at warung scale; older history stays queryable the
// day the page grows real pagination.
const LIST_LIMIT = 200;

// Bentuk baris GET /transactions (backend-go TransactionSummary).
type GoTransactionRow = {
  id: number;
  receipt_no: string;
  created_at: string;
  payment_method: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  item_count: number;
  cashier_name: string;
  claim_code: string | null;
  handover_status: string | null;
};

// Bentuk baris produk GET /reports/profit (backend-go ProfitProductRow).
type GoProfitProductRow = {
  product_id: number;
  name: string;
  unit: string;
  sold_quantity: number;
  revenue_rupiah: number;
  cost_rupiah: number;
  profit_rupiah: number;
  margin_pct: number | null;
};

type GoProfitSummary = {
  period_days: number;
  transaction_count: number;
  omzet_rupiah: number;
  cost_rupiah: number;
  profit_rupiah: number;
  margin_pct: number | null;
  rows: GoProfitProductRow[];
};

// Pemetaan murni snake_case Go -> bentuk camelCase komponen klien —
// komponenTransactionsClient dan types.ts tidak berubah sama sekali.
function mapProfit(s: GoProfitSummary): ProfitSummary {
  return {
    periodDays: s.period_days,
    transactionCount: s.transaction_count,
    omzetRupiah: s.omzet_rupiah,
    costRupiah: s.cost_rupiah,
    profitRupiah: s.profit_rupiah,
    marginPct: s.margin_pct,
    rows: s.rows.map((row) => ({
      productId: String(row.product_id),
      name: row.name,
      unit: row.unit,
      soldQuantity: row.sold_quantity,
      revenueRupiah: row.revenue_rupiah,
      costRupiah: row.cost_rupiah,
      profitRupiah: row.profit_rupiah,
      marginPct: row.margin_pct,
    })),
  };
}

export default async function OwnerTransactionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") redirect("/cashier");
  const token = session.user.goToken;
  if (!token) redirect("/login");

  // Outlet konteks ditentukan Go (ikatan akun / cookie maintenance dev) —
  // satu pintu yang sama dengan kasir & dashboard, tanpa fallback tabel
  // beku era Prisma.
  const outlet = await getOutletContext();
  if (!outlet) redirect("/owner");

  // Riwayat + ringkasan laba 7/30 hari dalam dua panggilan paralel.
  // Omzet hanya menghitung struk COMPLETED — refund mengembalikan uang,
  // jadi tidak pernah masuk angka laba (dihitung Go, sama dengan era
  // Prisma). Backend mati = halaman gagal dengan pesan yang jelas —
  // tidak ada angka palsu untuk keputusan bisnis.
  const [listRes, profitRes] = await Promise.all([
    goFetch<GoTransactionRow[]>(token, `/transactions?limit=${LIST_LIMIT}`),
    goFetch<{ week: GoProfitSummary; month: GoProfitSummary }>(
      token,
      "/reports/profit",
    ),
  ]);
  if (!listRes.ok) throw new Error(listRes.message);
  if (!profitRes.ok) throw new Error(profitRes.message);
  if (!Array.isArray(listRes.data) || !profitRes.data?.week || !profitRes.data?.month) {
    throw new Error(
      "Backend lama masih berjalan di port 8080 (tanpa scope outlet v1.5.0). Jalankan docker compose up -d --build, lalu muat ulang halaman ini.",
    );
  }

  const listRows: TransactionRow[] = listRes.data.map((row) => ({
    id: String(row.id),
    code: row.receipt_no,
    createdAtIso: row.created_at,
    paymentMethod: row.payment_method,
    status: row.status,
    subtotalRupiah: Math.round(row.subtotal),
    discountRupiah: Math.round(row.discount),
    totalRupiah: Math.round(row.total),
    itemCount: row.item_count,
    cashierName: row.cashier_name ?? "-",
    claimCode: row.claim_code,
    handoverStatus: row.handover_status,
  }));

  return (
    <TransactionsClient
      outletName={outlet.name}
      userName={session.user.name ?? "Pemilik"}
      rows={listRows}
      weekSummary={mapProfit(profitRes.data.week)}
      monthSummary={mapProfit(profitRes.data.month)}
      me={userMenuUser(session)}
    />
  );
}
