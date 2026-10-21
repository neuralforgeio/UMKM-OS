// View models for the owner stock page. Money crosses the server/client
// boundary as whole-Rupiah integers (warung prices never carry cents),
// and timestamps arrive pre-formatted so client hydration renders the
// exact same string the server produced.

// A product the owner can restock: low-stock items are highlighted,
// but every active product is reachable through the picker.
export type RestockTarget = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  costRupiah: number;
  // Same suggestion formula as the dashboard widget: enough units to
  // reach twice the minimum, at least one.
  suggestedQty: number;
};

export type StockMovementKind = "IN" | "SALE" | "ADJUST";

export type MovementRow = {
  id: string;
  productName: string;
  sku: string;
  unit: string;
  kind: StockMovementKind;
  quantity: number;
  unitCostRupiah: number | null;
  note: string | null;
  userName: string | null;
  transactionCode: string | null;
  timeLabel: string;
};
