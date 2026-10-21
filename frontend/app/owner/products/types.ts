// View models for the owner product management page. Money crosses the
// server/client boundary as whole-Rupiah integers (warung prices never
// carry cents), so the client never touches Decimal objects.
export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string | null;
  priceRupiah: number;
  costRupiah: number;
  stock: number;
  minStock: number;
  unit: string;
  isActive: boolean;
  soldLast30Days: number;
};

export type CategoryOption = {
  id: string;
  name: string;
};
