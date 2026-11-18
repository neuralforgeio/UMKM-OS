// Test riwayat perubahan UMKM OS (terbaru 1.3.0) (lib/changelog.ts), murni.
//
// Yang dikunci: entri tersusun dari versi terbaru ke terlama, setiap
// entri punya versi/tanggal/judul/butir utuh, versi tidak dobel,
// entri 1.2.0 memuat kebebasan OSCAR menjawab (prompt dwi-mode,
// validasi angka khusus bisnis, data terbaru per pertanyaan), entri
// 1.1.1 memuat perbaikan obrolan OSCAR + healthcheck tenang,
// entri 1.1.0 memuat perubahan besar yang benar benar terpasang
// (murni AI, Ctrl+B, Changelog, kartu Tanya OSCAR dihapus), entri
// 1.0.0 tetap tercatat sebagai sejarah, dan tanggal ISO diterjemahkan
// ke bahasa Indonesia. Standar: Bahasa Indonesia, stdlib Node saja.
import { describe, expect, it } from "vitest";
import {
  CHANGELOG,
  cariEntri,
  formatTanggalId,
  versiTerbaru,
} from "@/lib/changelog";

describe("CHANGELOG, sumber data tombol Changelog topbar", () => {
  it("tersusun dari versi terbaru ke terlama", () => {
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(2);
    expect(CHANGELOG[0].versi).toBe(versiTerbaru());
  });

  it("setiap entri punya versi semver, tanggal ISO, judul, dan minimal tiga butir", () => {
    for (const entri of CHANGELOG) {
      expect(entri.versi).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entri.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entri.judul.trim().length).toBeGreaterThan(3);
      expect(entri.butir.length).toBeGreaterThanOrEqual(3);
      for (const butir of entri.butir) {
        expect(butir.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it("versi tidak boleh dobel antar entri", () => {
    const versi = CHANGELOG.map((e) => e.versi);
    expect(new Set(versi).size).toBe(versi.length);
  });
});

describe("entri v1.3.0 memuat era Go murni yang benar benar terpasang", () => {
  it("butir 1.3.0 menyebut satu backend Go, OSCAR pindah, dan penghapusan Python", () => {
    const entri = cariEntri("1.3.0");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("SATU-SATUNYA backend");
    expect(gabung).toContain("dihapus total");
    expect(gabung).toContain("prompt dwi-mode");
    expect(gabung).toContain("Developer AI");
    expect(gabung).toContain("dikunci developer");
    expect(gabung).toContain("IP");
    expect(gabung).toContain("unik per outlet");
  });

  it("versi terbaru kini 1.5.0, entri 1.4.3 s.d. 1.1.1 tetap utuh di bawahnya", () => {
    expect(versiTerbaru()).toBe("1.5.0");
    expect(CHANGELOG[0].versi).toBe("1.5.0");
    expect(CHANGELOG[1].versi).toBe("1.4.3");
    expect(CHANGELOG[2].versi).toBe("1.4.2");
    expect(CHANGELOG[3].versi).toBe("1.4.1");
    expect(CHANGELOG[4].versi).toBe("1.4.0");
    expect(CHANGELOG[5].versi).toBe("1.3.1");
    expect(CHANGELOG[6].versi).toBe("1.3.0");
    expect(CHANGELOG[7].versi).toBe("1.2.0");
    expect(CHANGELOG[8].versi).toBe("1.1.1");
    expect(cariEntri("1.2.0")).not.toBeNull();
  });
});

describe("entri v1.5.0 memuat gerbang developer", () => {
  it("butir 1.5.0 menyebut enam alat + tendang seketika + hanya-baca", () => {
    const entri = cariEntri("1.5.0");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("Pusat Kendali");
    expect(gabung).toContain("Sesi Aktif");
    expect(gabung).toContain("Bendera Fitur");
    expect(gabung).toContain("Registri Pengaturan");
    expect(gabung).toContain("SQL Console");
    expect(gabung).toContain("Metrik");
    expect(gabung).toContain("seketika");
    expect(gabung).toContain("tanpa memaksa semua orang login ulang");
  });
});

describe("entri v1.4.3 memuat penjamin kolom cadangan", () => {
  it("butir 1.4.3 menyebut kolom warisan di tabel aplikasi, tipe dibaca dari sumber, dan kolom tak diubah", () => {
    const entri = cariEntri("1.4.3");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("kolom warisan");
    expect(gabung).toContain("dibaca langsung dari database sumber");
    expect(gabung).toContain("tidak dihapus, tidak diubah");
  });
});

describe("entri v1.4.2 memuat perbaikan tabel warisan", () => {
  it("butir 1.4.2 menyebut tabel warisan alat lama, sumber struktur sama, dan reproduksi kondisi nyata", () => {
    const entri = cariEntri("1.4.2");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("tabel warisan");
    expect(gabung).toContain("tidak akan pernah basi");
    expect(gabung).toContain("kondisi nyata mesin pemilik");
  });
});

describe("entri v1.4.1 memuat perbaikan cadangan murni aplikasi", () => {
  it("butir 1.4.1 menyebut alat eksternal versi tak cocok, murni kode aplikasi, dan urutan tabel", () => {
    const entri = cariEntri("1.4.1");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("versi tidak cocok");
    expect(gabung).toContain("kode aplikasi");
    expect(gabung).toContain("diterapkan ulang");
    expect(gabung).toContain("satu-kesatuan");
  });
});

describe("entri v1.4.0 memuat cadangan data + salinan database", () => {
  it("butir 1.4.0 menyebut tombol cadangkan, failover, sinkron balik, dan PROBERAW", () => {
    const entri = cariEntri("1.4.0");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("Cadangkan Data Sekarang");
    expect(gabung).toContain("salinan");
    expect(gabung).toContain("failover");
    expect(gabung).toContain("sinkron balik");
    expect(gabung).toContain("PROBERAW");
  });
});

describe("entri v1.3.1 memuat perbaikan pra-rilis halaman Transaksi", () => {
  it("butir 1.3.1 menyebut panel diagnosis pengganti #441, NaN laba, error boundary, dan test", () => {
    const entri = cariEntri("1.3.1");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("React error #441");
    expect(gabung).toContain("panel diagnosis");
    expect(gabung).toContain("NaN");
    expect(gabung).toContain("error boundary");
    expect(gabung).toContain("Coba Lagi");
    expect(gabung).toContain("15 test");
  });
});

describe("entri v1.2.0 memuat kebebasan OSCAR yang benar benar terpasang", () => {
  it("butir 1.2.0 menyebut prompt dwi-mode, validasi khusus bisnis, dan data terbaru", () => {
    const entri = cariEntri("1.2.0");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("prompt dwi-mode");
    expect(gabung).toContain("pertanyaan APA PUN");
    expect(gabung).toContain("validasi angka");
    expect(gabung).toContain("bisnis warung");
    expect(gabung).toContain("data terbaru");
    expect(gabung).toContain("400 menjadi 700");
  });

  it("versi terbaru kini 1.5.0; susunan 1.4.3 s.d. 1.1.1 tetap tercatat", () => {
    expect(versiTerbaru()).toBe("1.5.0");
    expect(CHANGELOG[0].versi).toBe("1.5.0");
    expect(CHANGELOG[1].versi).toBe("1.4.3");
    expect(CHANGELOG[2].versi).toBe("1.4.2");
    expect(CHANGELOG[3].versi).toBe("1.4.1");
    expect(CHANGELOG[4].versi).toBe("1.4.0");
    expect(CHANGELOG[5].versi).toBe("1.3.1");
    expect(CHANGELOG[6].versi).toBe("1.3.0");
    expect(CHANGELOG[7].versi).toBe("1.2.0");
    expect(CHANGELOG[8].versi).toBe("1.1.1");
    expect(cariEntri("1.1.0")).not.toBeNull();
  });
});

describe("entri v1.1.1 memuat perbaikan yang benar benar terpasang", () => {
  it("butir 1.1.1 menyebut normalisasi peran huruf kecil dan probe /health 60 detik", () => {
    const entri = cariEntri("1.1.1");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("huruf kecil");
    expect(gabung).toContain("60 detik");
    expect(gabung).toContain("/health");
    expect(gabung).toContain("dua lapis");
  });
});

describe("entri v1.1.0 memuat perubahan yang benar benar terpasang", () => {
  it("butir 1.1.0 menyebut murni AI, Ctrl+B, Changelog, dan hapus Tanya OSCAR", () => {
    const entri = cariEntri("1.1.0");
    expect(entri).not.toBeNull();
    const gabung = entri!.butir.join(" ");
    expect(gabung).toContain("murni obrolan AI");
    expect(gabung).toContain("Ctrl+B");
    expect(gabung).toContain("Changelog");
    expect(gabung).toContain("Tanya OSCAR");
    expect(gabung).toContain("Groq");
  });

  it("entri 1.0.0 tetap tercatat sebagai sejarah shell operasional", () => {
    const entri = cariEntri("1.0.0");
    expect(entri).not.toBeNull();
    expect(entri!.butir.join(" ")).toContain("Groq");
  });

  it("versi tak dikenal menghasilkan null, bukan melempar", () => {
    expect(cariEntri("9.9.9")).toBeNull();
  });
});

describe("formatTanggalId menerjemahkan tanggal ISO", () => {
  it("tanggal valid jadi bahasa Indonesia tanpa nol depan", () => {
    expect(formatTanggalId("2026-11-01")).toBe("1 November 2026");
    expect(formatTanggalId("2026-10-31")).toBe("31 Oktober 2026");
  });

  it("tanggal tidak valid dikembalikan apa adanya", () => {
    expect(formatTanggalId("segera")).toBe("segera");
  });
});
