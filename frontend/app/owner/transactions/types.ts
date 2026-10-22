// Types shared between the server page and the client component of the
// owner transaction history feature.

export type TransactionRow = {
  id: string;
  code: string;
  createdAtIso: string;
  // "CASH", "QRIS", "DEBIT"
  paymentMethod: string;
  status: string;
  subtotalRupiah: number;
  discountRupiah: number;
  totalRupiah: number;
  itemCount: number;
  cashierName: string;
  claimCode: string | null;
  // null, "COURIER_CLAIMED" | "CONFIRMED" | "DISPUTED"
  handoverStatus: string | null;
};

export type TransactionDetailItem = {
  productName: string;
  unit: string;
  quantity: number;
  priceAtSaleRupiah: number;
  subtotalRupiah: number;
};

export type TransactionDetail = {
  id: string;
  code: string;
  createdAtIso: string;
  paymentMethod: string;
  status: string;
  subtotalRupiah: number;
  discountRupiah: number;
  totalRupiah: number;
  paidRupiah: number;
  changeRupiah: number;
  cashierName: string;
  claimCode: string | null;
  handoverStatus: string | null;
  items: TransactionDetailItem[];
};

export type DetailResult =
  | { ok: true; detail: TransactionDetail }
  | { ok: false; error: string };

export type ProductProfitRow = {
  productId: string;
  name: string;
  unit: string;
  soldQuantity: number;
  revenueRupiah: number;
  // qty x CURRENT product cost (cost is not snapshotted at sale time.)
  costRupiah: number;
  profitRupiah: number;
  marginPct: number | null;
};

export type ProfitSummary = {
  periodDays: number;
  transactionCount: number;
  omzetRupiah: number;
  costRupiah: number;
  profitRupiah: number;
  marginPct: number | null;
  rows: ProductProfitRow[];
};
