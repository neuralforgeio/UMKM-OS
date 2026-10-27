// Test penjaga sinkronisasi profil lintas-halaman (v2.4.1).
//
// Bug asli (laporan pengguna, 2026-10-27): setelah ganti foto profil
// di /account, navbar halaman LAIN tetap menampilkan inisial. Akar
// masalahnya photoVersion hanya hidup di token JWT sesi, yang hanya
// disinkronkan jwt-recheck tiap 5 menit — foto baru tidak pernah
// sampai ke halaman lain sebelum itu (atau setelah login ulang).
//
// Perbaikan yang dikunci di sini:
//   1. lib/auth.ts mengekspor unstable_update dan callback jwt
//      menangani trigger "update" — photoVersion/nama/email disuntik
//      SEGERA dari server action, bukan menunggu recheck 5 menit.
//   2. app/account/actions.ts memanggil unstable_update tepat setelah
//      Go sukses menyimpan (unggah/hapus foto, simpan identitas),
//      dibungkus try/catch agar kegagalan suntikan sesi tidak pernah
//      menggagalkan aksi simpannya sendiri.
//   3. UserAvatar me-reset fallback foto-rusak saat versi foto
//      berubah — dulu sekali 404 berarti inisial selamanya walau
//      foto baru sudah diunggah kembali.
//   4. Halaman /account tetap membaca identitas SEGAR dari Go.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DOM/DB/jaringan.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");

describe("v2.4.1 — callback jwt menerima suntikan sesi (trigger update)", () => {
  it("lib/auth.ts mengekspor unstable_update dari NextAuth()", () => {
    const isi = baca("lib/auth.ts");
    expect(isi).toContain("unstable_update");
    expect(isi).toContain("} = NextAuth({");
  });

  it("callback jwt menangani trigger update untuk foto/nama/email", () => {
    const isi = baca("lib/auth.ts");
    expect(isi).toContain('trigger === "update"');
    expect(isi).toContain("token.photoVersion = perubahan.photoVersion");
    expect(isi).toContain("token.name = perubahan.name");
    expect(isi).toContain("token.email = perubahan.email");
  });

  it("jwt-recheck 5 menit tetap hidup sebagai jaring pengaman", () => {
    const isi = baca("lib/auth.ts");
    expect(isi).toContain("RECHECK_MS");
    expect(isi).toContain("/auth/me");
  });
});

describe("v2.4.1 — server action /account menyuntik sesi setelah Go sukses", () => {
  it("unggah, hapus, dan simpan identitas sama-sama menyuntik sesi", () => {
    const isi = baca("app/account/actions.ts");
    // Tiga aksi berbeda, tiga suntikan.
    expect(isi.split("await unstable_update(").length - 1).toBeGreaterThanOrEqual(3);
    expect(isi).toContain("photoVersion:");
    expect(isi).toContain("res.data?.photo_version");
  });

  it("hapus foto membaca photo_version dari respons Go", () => {
    const isi = baca("app/account/actions.ts");
    expect(isi).toContain("photo_version?: number");
  });

  it("simpan identitas menyuntik nama & email baru", () => {
    const isi = baca("app/account/actions.ts");
    expect(isi).toContain("user: {");
    expect(isi).toContain("name: res.data?.name ?? name");
    expect(isi).toContain("email: res.data?.email ?? email");
  });

  it("suntikan sesi dibungkus try/catch — simpan tidak pernah ikut gagal", () => {
    const isi = baca("app/account/actions.ts");
    // Ketiga aksi masing-masing punya pelindung komentar-catch yang sama.
    expect(isi.split("// Suntikan sesi gagal").length - 1).toBeGreaterThanOrEqual(3);
  });
});

describe("v2.4.1 — UserAvatar pulih saat versi foto berubah", () => {
  it("photoBroken di-reset saat photoVersion berubah", () => {
    const isi = baca("components/user-menu.tsx");
    expect(isi).toContain("setPhotoBroken(false)");
    expect(isi).toMatch(
      /useEffect\(\(\) => \{\s*setPhotoBroken\(false\);\s*\}, \[user\.photoVersion\]\);/,
    );
  });

  it("URL foto tetap berversi + cache privat (proxy /api/user/photo)", () => {
    const isi = baca("app/api/user/photo/route.ts");
    expect(isi).toContain('cache: "no-store"');
    expect(isi).toContain("private, max-age=3600, must-revalidate");
  });
});

describe("v2.4.1 — /account tetap membaca identitas segar dari Go", () => {
  it("halaman memuat profil via GET /auth/me, bukan dari sesi", () => {
    const isi = baca("app/account/page.tsx");
    expect(isi).toContain('"/auth/me"');
    expect(isi).toContain("me.data.photo_version");
  });
});
