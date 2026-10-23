// Tipe baris tabel akun (Task 34 Fase B, diperbarui Task 35). Murni
// serial (string/boolean) supaya bisa melewati batas server component ->
// client component tanpa transformasi — pola yang sama dengan
// ProductRow dan TransactionRow.
export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "KASIR" | "DEVELOPER";
  outletId: string | null;
  outletName: string | null;
  isActive: boolean;
  createdAtIso: string;
  // Transaksi terakhir yang dicatat user sebagai kasir (null = belum
  // pernah). Sinyal cepat "akun ini benar-benar dipakai jualan".
  lastTransactionAtIso: string | null;
};

export type OutletOption = {
  id: string;
  name: string;
};
