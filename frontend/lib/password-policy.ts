// Kebijakan password UMKM OS (Task 35).
//
// SATU sumber kebenaran untuk dua pihak yang WAJIB setuju:
//   1. komponen <PasswordInput> — checklist hidup (hijau saat mengetik),
//   2. server actions — validasi final (UI bisa dipalsukan, server tidak).
// Syarat persis sesuai permintaan pemilik: minimal 8 karakter, ada huruf
// besar, ada simbol. Spasi tidak dihitung sebagai simbol supaya "a b c"
// tidak dianggap kuat.

export type PasswordRule = {
  key: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  {
    key: "length",
    label: "Minimal 8 karakter",
    test: (v) => v.length >= 8,
  },
  {
    key: "upper",
    label: "Ada huruf besar (A–Z)",
    test: (v) => /[A-Z]/.test(v),
  },
  {
    key: "symbol",
    label: "Ada simbol (!@#$%^&*…)",
    test: (v) => /[^A-Za-z0-9\s]/.test(v),
  },
];

// true hanya kalau SEMUA syarat lolos.
export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

// Daftar label syarat yang GAGAL — dipakai menyusun pesan error ramah di
// server, mis. "Password belum memenuhi: huruf besar, simbol."
export function failedPasswordRules(value: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map(
    (rule) => rule.label.toLowerCase(),
  );
}
