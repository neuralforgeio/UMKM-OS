import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { userMenuUser } from "@/lib/session-user";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import {
  StockClient,
  type StockMovementRow,
  type StockProductOption,
} from "./stock-client";

export const instant = false;

// Build the formatter once at module level; timezone locked to Jakarta.
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type GoProduct = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  unit: string;
  cost: number;
};

type GoMovement = {
  id: number;
  product_name: string;
  sku: string | null;
  unit: string;
  type: string;
  qty: number;
  unit_cost: number | null;
  note: string;
  user_name: string | null;
  receipt_no: string | null;
  created_at: string;
};

export default async function OwnerStockPage() {
  // Same guard pattern as the products page: reading cookies also makes
  // the route request-dynamic, which is what cacheComponents expects
  // (route segment "dynamic" config is not allowed there).
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER")
    redirect("/cashier");
  if (!session.user.goToken) {
    throw new Error("Sesi tidak memiliki token backend — silakan login ulang.");
  }
  const goToken = session.user.goToken;

  // Produk aktif + 200 gerakan terakhir + total gerakan, semuanya dari
  // backend-go — kartu stok dan kasir membaca angka yang sama.
  const [productsResult, movementsResult] = await Promise.all([
    goFetch<GoProduct[]>(goToken, "/products"),
    goFetch<{ total: number; rows: GoMovement[] }>(
      goToken,
      "/stock-movements?limit=200",
    ),
  ]);
  if (!productsResult.ok) throw new Error(productsResult.message);
  if (!movementsResult.ok) throw new Error(movementsResult.message);

  const productOptions: StockProductOption[] = productsResult.data.map(
    (product) => ({
      id: String(product.id),
      name: product.name,
      sku: product.sku ?? "",
      stock: product.stock,
      minStock: product.min_stock,
      unit: product.unit || "pcs",
      costRupiah: product.cost,
    }),
  );

  // Rows are plain serializable objects. Display strings are prepared on
  // the server so the client render stays hydration-safe. Gerakan OUT
  // yang terikat nomor struk = penjualan kasir — ditampilkan SALE agar
  // makna barisnya sama dengan era sebelumnya.
  const movementRows: StockMovementRow[] = movementsResult.data.rows.map(
    (movement) => ({
      id: String(movement.id),
      productName: movement.product_name,
      sku: movement.sku ?? "",
      unit: movement.unit || "pcs",
      type:
        movement.type === "OUT" && movement.receipt_no ? "SALE" : movement.type,
      quantity: movement.qty,
      unitCostRupiah: movement.unit_cost,
      note: movement.note || null,
      userName: movement.user_name,
      transactionCode: movement.receipt_no,
      timeLabel: timeFmt.format(new Date(movement.created_at)),
    }),
  );

  const lowStockCount = productOptions.filter(
    (product) => product.stock <= product.minStock,
  ).length;

  // v3.2.0: identitas outlet untuk sidebar (pola yang sama dengan
  // halaman owner lain — tanpa mengubah pengambilan data stok).
  const outlet = await getOutletContext();
  const logoUrl = outlet ? outletLogoUrl(outlet) : null;

  const stats = [
    {
      label: "Jenis produk",
      value: productOptions.length.toLocaleString("id-ID"),
    },
    {
      label: "Total unit stok",
      value: productOptions
        .reduce((sum, product) => sum + product.stock, 0)
        .toLocaleString("id-ID"),
    },
    { label: "Perlu restok", value: lowStockCount.toLocaleString("id-ID") },
    {
      label: "Gerakan tercatat",
      value: movementsResult.data.total.toLocaleString("id-ID"),
    },
  ];

  return (
    // Shell v3.2.0: sidebar WORKSPACE/MANAGE (pola PDF "Inventory &
    // procurement") — kartu stok memakai permukaan tenang, ikut tema.
    <WorkspaceShell
      variant="owner"
      active="stok"
      user={userMenuUser(session)}
      outletName={outlet?.name}
      logoUrl={logoUrl}
      overline="Kelola Stok"
      title="Kartu stok & pengadaan"
      desc="Catat restok dan hasil opname. Setiap perubahan stok terekam di riwayat, terbaru paling atas."
    >

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const warn = stat.label === "Perlu restok" && lowStockCount > 0;
          return (
            <div
              key={stat.label}
              className="glass-card rounded-2xl p-4 sm:p-5"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {stat.label}
              </dt>
              <dd
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  warn ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {stat.value}
              </dd>
            </div>
          );
        })}
      </dl>

      <StockClient products={productOptions} rows={movementRows} />
    </WorkspaceShell>
  );
}