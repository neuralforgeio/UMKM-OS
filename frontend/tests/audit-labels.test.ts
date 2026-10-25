import { describe, expect, it } from "vitest";

// Unit test untuk lib/audit-labels.ts â€” penerjemah aksi audit.
// Murni, tanpa database. Fokus v1.6.0: LEVEL_BADGE harus punya varian
// gelap (dark:) supaya chip log tetap terbaca saat konsol developer
// berjalan di tema gelap â€” regresi dari bug "halaman tidak ikut tema".

import {
  LEVEL_BADGE,
  actionLabel,
  actionLevel,
  levelWhereHint,
  warnActions,
} from "@/lib/audit-labels";

describe("actionLevel", () => {
  it("aksi berakhiran _FAILED selalu GAGAL", () => {
    expect(actionLevel("LOGIN_FAILED")).toBe("GAGAL");
    expect(actionLevel("TRANSACTION_CREATE_FAILED")).toBe("GAGAL");
  });

  it("aksi sensitif ditandai PERINGATAN", () => {
    expect(actionLevel("ACCOUNT_DELETE")).toBe("PERINGATAN");
    expect(actionLevel("DEV_MAINTENANCE_ENTER")).toBe("PERINGATAN");
  });

  it("aksi biasa SUKSES", () => {
    expect(actionLevel("LOGIN_SUCCESS")).toBe("SUKSES");
    expect(actionLevel("TRANSACTION_CREATE")).toBe("SUKSES");
  });
});

describe("actionLabel", () => {
  it("aksi terdaftar diterjemahkan ke bahasa manusia", () => {
    expect(actionLabel("LOGIN_SUCCESS")).toBe("Login berhasil");
    expect(actionLabel("STOCK_ADJUST")).toBe("Stok disesuaikan manual");
  });

  it("varian _FAILED yang basisnya dikenal tetap terbaca", () => {
    expect(actionLabel("LOGIN_FAILED")).toBe("Login gagal");
  });

  it("aksi asing tampil apa adanya, bukan kosong", () => {
    expect(actionLabel("AKSI_BARU")).toBe("AKSI_BARU");
  });
});

describe("warnActions", () => {
  it("mengembalikan salinan â€” pemanggil tidak bisa mengubah daftar asli", () => {
    const a = warnActions();
    const b = warnActions();
    expect(a).toEqual(b);
    a.push("BOGUS");
    expect(warnActions()).not.toContain("BOGUS");
    expect(b).not.toContain("BOGUS");
  });
});

describe("levelWhereHint", () => {
  it("hanya menerima tiga tingkat sah, selain itu null", () => {
    expect(levelWhereHint("SUKSES")).toBe("SUKSES");
    expect(levelWhereHint("PERINGATAN")).toBe("PERINGATAN");
    expect(levelWhereHint("GAGAL")).toBe("GAGAL");
    expect(levelWhereHint("sukses")).toBeNull();
    expect(levelWhereHint("")).toBeNull();
  });
});

describe("LEVEL_BADGE (sadar tema v1.6.0)", () => {
  it("setiap tingkat punya kelas teks + latar + ring", () => {
    for (const lvl of ["SUKSES", "PERINGATAN", "GAGAL"] as const) {
      const badge = LEVEL_BADGE[lvl];
      expect(badge).toContain("text-");
      expect(badge).toContain("bg-");
      expect(badge).toContain("ring-");
    }
  });

  it("setiap tingkat punya varian dark: (bug: log pucat di tema gelap)", () => {
    for (const lvl of ["SUKSES", "PERINGATAN", "GAGAL"] as const) {
      const badge = LEVEL_BADGE[lvl];
      expect(badge).toContain("dark:bg-");
      expect(badge).toContain("dark:text-");
      expect(badge).toContain("dark:ring-");
    }
  });

  it("warna tingkat tidak tertukar: hijau sukses, amber peringatan, merah gagal", () => {
    expect(LEVEL_BADGE.SUKSES).toContain("emerald");
    expect(LEVEL_BADGE.PERINGATAN).toContain("amber");
    expect(LEVEL_BADGE.GAGAL).toContain("red");
  });
});