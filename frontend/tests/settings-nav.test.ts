import { describe, expect, it } from "vitest";

// Unit test untuk navigasi halaman /settings (lib/settings-nav.ts) â€”
// murni, tanpa React/router, jadi hasilnya pasti sama di mesin mana pun.
// Yang dijaga: tombol "Kembali" di /settings harus memulangkan tiap
// peran ke areanya sendiri, bukan selalu ke /login (bug lama v1.3.0).

import {
  settingsBackHref,
  settingsBackLabel,
  type SettingsRole,
} from "@/lib/settings-nav";

const KASUS: { role: SettingsRole; href: string; label: string }[] = [
  { role: "DEVELOPER", href: "/dev", label: "Kembali ke Konsol Developer" },
  { role: "OWNER", href: "/owner", label: "Kembali ke Konsol Owner" },
  { role: "KASIR", href: "/cashier", label: "Kembali ke Kasir" },
];

describe("settingsBackHref", () => {
  it.each(KASUS)(
    "peran $role pulang ke areanya sendiri ($href)",
    ({ role, href }) => {
      expect(settingsBackHref(role)).toBe(href);
    },
  );

  it("pengunjung tanpa sesi (null) kembali ke halaman login", () => {
    expect(settingsBackHref(null)).toBe("/login");
  });

  it("undefined (sesi rusak / belum terbaca) tetap aman ke login", () => {
    expect(settingsBackHref(undefined)).toBe("/login");
  });
});

describe("settingsBackLabel", () => {
  it.each(KASUS)(
    "label tombol menyebut tujuan peran $role secara jelas",
    ({ role, label }) => {
      expect(settingsBackLabel(role)).toBe(label);
    },
  );

  it("pengunjung anonim mendapat label kembali-masuk, bukan kosong", () => {
    const label = settingsBackLabel(null);
    expect(label.length).toBeGreaterThan(0);
    expect(settingsBackLabel(undefined)).toBe(label);
  });
});