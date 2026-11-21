import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GUARD v1.7.1 (run-14): toast + dialog custom menggantikan alert/
// confirm/prompt bawaan browser (permintaan pemilik: jangan pakai
// dialog bawaan Chrome) + bug produksi net/ping 400 + sesi 400 +
// bug UTF-8 rune.

function bacaFE(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf-8");
}
function bacaBE(rel: string): string {
  return readFileSync(join(process.cwd(), "..", rel), "utf-8");
}

describe("bug produksi: net/ping 400 saat Periksa", () => {
  it("backend: koneksi gagal = 502 + pesan penjelasan, bukan 400", () => {
    const h = bacaBE("backend/internal/handler/shell.go");
    expect(h).toContain("http.StatusBadGateway");
    expect(h).toContain("5433");
    expect(h).toContain("db:5432");
    expect(h).toContain("func ValidasiPortTCP");
  });

  it("frontend: default port 5433 (compose) + tombol cepat + inputMode", () => {
    const t = bacaFE("app/dev/shell/tab-net.tsx");
    expect(t).toContain('useState("5433")');
    expect(t).toContain("CEPAT_NET");
    expect(t).toContain("DB pusat (host 5433)");
    expect(t).toContain('inputMode="numeric"');
    expect(t).not.toContain('useState("5432")');
  });
});

describe("bug produksi: UTF-8 terbelah (GitHub issues)", () => {
  it("textutil.PotongRune ada + 7 tes unit", () => {
    const u = bacaBE("backend/internal/textutil/textutil.go");
    expect(u).toContain("func PotongRune");
    const t = bacaBE("backend/internal/textutil/textutil_test.go");
    for (const nama of [
      "TestPotongRuneASCII",
      "TestPotongRuneEmDashTidakTerbelah",
      "TestPotongRuneBeragamNonASCII",
      "TestPotongRuneNamaPembeli40",
      "TestPotongRuneCatatan200",
      "TestPotongRuneTepi",
      "TestPotongRuneUnggul",
    ]) {
      expect(t).toContain(nama);
    }
  });

  it("semua situs potong byte di handler kini PotongRune", () => {
    for (const f of [
      "backend/internal/handler/refund.go",
      "backend/internal/handler/handover.go",
      "backend/internal/handler/auth.go",
    ]) {
      const h = bacaBE(f);
      expect(h).toContain("textutil.PotongRune");
      // potongan byte per-byte tak boleh tersisa di situs itu
      expect(h).not.toMatch(/reason\[:\d+\]/);
      expect(h).not.toMatch(/note\[:\d+\]/);
      expect(h).not.toMatch(/buyerName\[:\d+\]/);
      expect(h).not.toMatch(/ua\[:\d+\]/);
    }
  });
});

describe("toast + dialog custom (bukan bawaan browser)", () => {
  it("components/dialog.tsx menyediakan pengganti confirm/prompt", () => {
    const d = bacaFE("components/dialog.tsx");
    expect(d).toContain("export function DialogKonfirmasi");
    expect(d).toContain("export function DialogTeks");
    expect(d).toContain("export function DialogTunggu");
    expect(d).toContain("konfirmasiLiteral");
    expect(d).toContain("validasiKonfirmasiTeks");
    expect(d).toContain("Escape");
  });

  it("toast provider terpasang di layout akar (satu sumber)", () => {
    const l = bacaFE("app/layout.tsx");
    expect(l).toContain("ToastProvider");
    expect(l).toContain('components/ui/toast"');
  });

  it("TIDAK ada lagi alert/confirm/prompt bawaan di app", () => {
    const berkas = [
      "app/dev/shell/tab-berkas.tsx",
      "app/dev/shell/tab-server.tsx",
      "app/dev/shell/tab-env.tsx",
      "app/owner/verify/[id]/client.tsx",
    ];
    for (const f of berkas) {
      const isi = bacaFE(f);
      expect(isi, f).not.toMatch(/\bwindow\.confirm\(/);
      expect(isi, f).not.toMatch(/[^a-zA-Z](confirm|alert|prompt)\(/);
    }
  });

  it("tab-server: DialogTeks MATIKAN + DialogTunggu (bukan prompt)", () => {
    const t = bacaFE("app/dev/shell/tab-server.tsx");
    expect(t).toContain("DialogTeks");
    expect(t).toContain("DialogTunggu");
    expect(t).toContain("matikanBetul");
    expect(t).not.toContain("prompt(");
  });

  it("tab-berkas: DialogKonfirmasi merah untuk hapus", () => {
    const t = bacaFE("app/dev/shell/tab-berkas.tsx");
    expect(t).toContain("DialogKonfirmasi");
    expect(t).toContain("konfirmasiHapus");
    expect(t).toContain("hapusBetul");
  });

  it("tab-env: DialogKonfirmasi untuk buka nilai asli", () => {
    const t = bacaFE("app/dev/shell/tab-env.tsx");
    expect(t).toContain("DialogKonfirmasi");
    expect(t).toContain("konfirmasiBuka");
    expect(t).toContain("bukaBetul");
  });

  it("sesi aktif: pesan ditampilkan inline + tanpa alert", () => {
    const t = bacaFE("app/dev/sessions/sesi-client.tsx");
    expect(t).toContain("setPesan");
    expect(t).not.toMatch(/\balert\(/);
  });
});
