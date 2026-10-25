import { describe, expect, it } from "vitest";

// Unit test untuk pemetaan DTO backend-go -> baris tabel akun dan util
// tampilan (app/dev/users/view-helpers.ts). Murni â€” tidak menyentuh
// jaringan/database, jadi hasilnya pasti sama di mesin mana pun.

import {
  avatarGradient,
  formatWibDateTime,
  formatWibShort,
  initials,
  mapGoOutlets,
  mapGoUsers,
  normalizeRole,
  roleBadgeDark,
  roleView,
  toGoRole,
  type GoOutletDTO,
  type GoUserDTO,
} from "@/app/dev/users/view-helpers";

function contohUserDTO(): GoUserDTO {
  return {
    id: 7,
    name: "Budi Santoso",
    email: "budi@warung.id",
    role: "CASHIER",
    outlet_id: 3,
    outlet_name: "Warung Bu Sari",
    is_active: true,
    created_at: "2026-10-25T02:30:00Z",
    last_transaction_at: "2026-10-24T09:00:00Z",
  };
}

describe("normalizeRole", () => {
  it("mengubah CASHIER (istilah Go) menjadi KASIR (istilah frontend)", () => {
    expect(normalizeRole("CASHIER")).toBe("KASIR");
  });

  it("membiarkan OWNER dan DEVELOPER apa adanya", () => {
    expect(normalizeRole("OWNER")).toBe("OWNER");
    expect(normalizeRole("DEVELOPER")).toBe("DEVELOPER");
  });

  it("nilai tak dikenal jatuh ke KASIR, bukan error", () => {
    expect(normalizeRole("")).toBe("KASIR");
    expect(normalizeRole("SESUATU")).toBe("KASIR");
  });
});

describe("toGoRole", () => {
  it("KASIR dikirim sebagai CASHIER ke backend-go", () => {
    expect(toGoRole("KASIR")).toBe("CASHIER");
  });

  it("OWNER tetap OWNER", () => {
    expect(toGoRole("OWNER")).toBe("OWNER");
  });
});

describe("mapGoUsers", () => {
  it("memetakan satu baris lengkap dengan benar", () => {
    const [row] = mapGoUsers([contohUserDTO()]);
    expect(row).toEqual({
      id: "7",
      name: "Budi Santoso",
      email: "budi@warung.id",
      role: "KASIR",
      outletId: "3",
      outletName: "Warung Bu Sari",
      isActive: true,
      createdAtIso: "2026-10-25T02:30:00Z",
      lastTransactionAtIso: "2026-10-24T09:00:00Z",
    });
  });

  it("owner tanpa outlet: outlet null dan bukan string kosong", () => {
    const dto = contohUserDTO();
    dto.role = "OWNER";
    dto.outlet_id = null;
    dto.outlet_name = null;
    dto.last_transaction_at = null;
    const [row] = mapGoUsers([dto]);
    expect(row.outletId).toBeNull();
    expect(row.outletName).toBeNull();
    expect(row.lastTransactionAtIso).toBeNull(); // belum pernah jualan
    expect(row.role).toBe("OWNER");
  });

  it("daftar kosong tetap kosong (bukan undefined)", () => {
    expect(mapGoUsers([])).toEqual([]);
  });

  it("id numerik Go menjadi string (kunci React & URL aman)", () => {
    const [row] = mapGoUsers([contohUserDTO()]);
    expect(row.id).toBeTypeOf("string");
  });
});

describe("mapGoOutlets", () => {
  it("hanya membawa id + nama yang dibutuhkan form akun", () => {
    const dto: GoOutletDTO = {
      id: 2,
      name: "Warung Bu Sari",
      address: "Jl. Merdeka 1",
      phone: "0812",
      logo_version: 0,
      has_logo: false,
      is_active: true,
      user_count: 4,
      created_at: "2026-10-01T00:00:00Z",
    };
    expect(mapGoOutlets([dto])).toEqual([{ id: "2", name: "Warung Bu Sari" }]);
  });
});

describe("initials", () => {
  it("dua kata: huruf pertama kata pertama + kata terakhir", () => {
    expect(initials("Budi Santoso")).toBe("BS");
    expect(initials("sari widya astuti")).toBe("SA");
  });

  it("satu kata: dua huruf pertama kata itu", () => {
    expect(initials("Rina")).toBe("RI");
    expect(initials("b")).toBe("B");
  });

  it("spasi berlebih diabaikan, kosong jatuh ke tanda tanya", () => {
    expect(initials("  Budi   Santoso  ")).toBe("BS");
    expect(initials("   ")).toBe("?");
    expect(initials("")).toBe("?");
  });
});

describe("formatWibShort", () => {
  it("null (belum pernah jualan) tampil sebagai â€”", () => {
    expect(formatWibShort(null)).toBe("â€”");
  });

  it("tanggal UTC dikonversi ke WIB, bukan zona mesin", () => {
    // 25 Okt 2026 00:30 UTC = 25 Okt 2026 07:30 WIB -> tetap tanggal 25.
    expect(formatWibShort("2026-10-25T00:30:00Z")).toContain("25");
    // 25 Okt 2026 20:00 UTC = 26 Okt 2026 03:00 WIB -> tanggal bergeser
    // ke 26. Inilah yang dijaga test ini: label tidak boleh ikut zona
    // waktu mesin siapa pun yang membuka halaman.
    expect(formatWibShort("2026-10-25T20:00:00Z")).toContain("26");
  });

  it("format mengikuti locale id-ID (bulan singkat Indonesia)", () => {
    const hasil = formatWibShort("2026-10-25T00:30:00Z");
    expect(hasil).toMatch(/Okt/i);
  });
});

describe("roleView", () => {
  it("setiap peran punya label ramah + kelas badge", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const rv = roleView(role);
      expect(rv.label.length).toBeGreaterThan(0);
      expect(rv.badge.length).toBeGreaterThan(0);
    }
  });

  it("label bahasa Indonesia yang dibaca pengguna", () => {
    expect(roleView("OWNER").label).toBe("Owner");
    expect(roleView("KASIR").label).toBe("Kasir");
    expect(roleView("DEVELOPER").label).toBe("Developer");
  });
});

describe("roleBadgeDark (konsol Kelola Akun, sadar tema v1.6.0)", () => {
  it("label peran huruf besar untuk badge tabel", () => {
    expect(roleBadgeDark("OWNER").label).toBe("OWNER");
    expect(roleBadgeDark("KASIR").label).toBe("KASIR");
    expect(roleBadgeDark("DEVELOPER").label).toBe("DEVELOPER");
  });

  it("warna tiap peran beda: ungu developer, biru owner, hijau kasir", () => {
    expect(roleBadgeDark("DEVELOPER").badge).toContain("purple");
    expect(roleBadgeDark("OWNER").badge).toContain("blue");
    expect(roleBadgeDark("KASIR").badge).toContain("emerald");
  });

  it("badge selalu memuat border + tint supaya konsisten di kartu glass", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const { badge } = roleBadgeDark(role);
      expect(badge).toContain("border-");
      expect(badge).toContain("bg-");
      expect(badge).toContain("text-");
    }
  });

  it("v1.6.0: badge sadar tema â€” teks pekat untuk terang + varian dark:", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const { badge } = roleBadgeDark(role);
      // sisi terang: teks pekat (600/700) agar terbaca di kartu glass terang
      expect(badge).toMatch(/text-(blue|emerald|purple)-(600|700)/);
      // sisi gelap: varian dark: dengan teks pucat (300)
      expect(badge).toMatch(/dark:text-(blue|emerald|purple)-300/);
    }
  });
});

describe("avatarGradient", () => {
  it("gradien tiap peran mengikuti warna hirarki akses", () => {
    expect(avatarGradient("DEVELOPER")).toContain("purple");
    expect(avatarGradient("OWNER")).toContain("cyan");
    expect(avatarGradient("KASIR")).toContain("emerald");
  });

  it("tiap peran menghasilkan kelas from- dan to- yang lengkap", () => {
    for (const role of ["OWNER", "KASIR", "DEVELOPER"] as const) {
      const g = avatarGradient(role);
      expect(g).toMatch(/^from-/);
      expect(g).toContain(" to-");
    }
  });
});

describe("formatWibDateTime", () => {
  it("null (belum pernah jualan) tampil sebagai â€”", () => {
    expect(formatWibDateTime(null)).toBe("â€”");
  });

  it("tanggal + jam UTC dikonversi ke WIB dengan pemisah jam ':'", () => {
    // 23 Okt 2026 07:20 UTC = 23 Okt 2026 14:20 WIB.
    expect(formatWibDateTime("2026-10-23T07:20:00Z")).toBe(
      "23 Okt 2026 (14:20 WIB)",
    );
  });

  it("lewat tengah malam UTC bergeser ke tanggal WIB berikutnya", () => {
    // 25 Okt 2026 20:00 UTC = 26 Okt 2026 03:00 WIB.
    expect(formatWibDateTime("2026-10-25T20:00:00Z")).toBe(
      "26 Okt 2026 (03:00 WIB)",
    );
  });
});