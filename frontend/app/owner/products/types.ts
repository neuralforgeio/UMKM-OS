// View models for the owner product management page. Money crosses the
// server/client boundary as whole-Rupiah integers (warung prices never
// carry cents), so the client never touches Decimal objects.

// Photo reference: the full list lives in the manager modal, while
// thumbImageId is the resolved image shown in tables and the POS.
export type ProductImageRef = {
  id: string;
  isThumb: boolean;
};

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
  images: ProductImageRef[];
  thumbImageId: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
};
