export type PosProduct = {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  unit: string;
  minStock: number;
  categoryName: string | null;
  // Chosen product photo (thumbnail); null keeps the initials tile.
  thumbImageId: string | null;
};

export type CartLine = {
  productId: string;
  quantity: number;
};

// Cart line joined with its product, used by the client UI only.
export type CartLineView = {
  product: PosProduct;
  qty: number;
};

export type PaymentMethodValue = "CASH" | "QRIS" | "DEBIT";

// Discount entry: a flat Rupiah amount or a percentage of the subtotal.
// The browser only ever sends this (mode, value) pair - the server
// recomputes the final amount itself, so a tampered total never lands.
export type DiscountMode = "RP" | "PERCENT";

export type DiscountInput = {
  mode: DiscountMode;
  value: number; // Rupiah when mode is RP, whole percent (0-100) when PERCENT
};

// Editor state for the discount control. Both slots are kept so
// switching modes never loses what the kasir already typed.
export type DiscountState = {
  mode: DiscountMode;
  rpValueSen: number;
  percent: number;
};

export type CheckoutInput = {
  items: CartLine[];
  paymentMethod: PaymentMethodValue;
  paidAmount: number;
  discount?: DiscountInput;
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
  // Receipt QR as an inline SVG string, generated server-side by the
  // checkout action (QRCode.toString type "svg"). Empty string = QR
  // generation failed; the receipt itself is still valid and renders
  // without the QR block.
  qrSvg: string;
};

export type CheckoutResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; error: string };

// Outlet identity for the receipt + POS header. logoUrl is a
// cache-busted /api/outlet/logo?v=...URL, or null if no logo has
// been uploaded yet (receipts then center the outlet name)
export type OutletInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
};
