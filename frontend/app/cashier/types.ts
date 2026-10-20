export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  unit: string;
  minStock: number;
  categoryName: string | null;
};

export type CartLine = {
  productId: string;
  quantity: number;
};

export type PaymentMethodValue = "CASH" | "QRIS" | "DEBIT";

export type CheckoutInput = {
  items: CartLine[];
  paymentMethod: PaymentMethodValue;
  paidAmount: number;
  discount?: number;
};

export type ReceiptItem = {
  name: string;
  quantity: number;
  priceAtSale: number;
  subtotal: number;
};

export type Receipt = {
  code: string;
  createdAt: string;
  paymentMethod: PaymentMethodValue;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  items: ReceiptItem[];
};

export type CheckoutResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; error: string };
