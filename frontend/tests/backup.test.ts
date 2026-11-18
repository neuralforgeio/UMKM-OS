// Test CADANGAN DATA + SALINAN DATABASE (run-7, frontend 1.4.0).
//
// Yang dikunci (pelajaran run-3: kontrak JSON lintas-stack harus
// diuji dari KEDUA sisi):
//  1. lib/backup.ts — tipe + helper murni (formatUkuran, labelNode,
//     pesanSebab) memetakan kontrak handler backend 2.1.0 persis;
//  2. server actions backup-actions.ts memanggil endpoint admin yang
//     benar dengan metode yang benar (POST run / POST restore);
//  3. bagian Pengaturan benar-benar memakai BackupForm + membaca
//     status server-side;
//  4. backend memasang fitur yang diklaim (Dockerfile runtime
//     postgresql-client + compose db-salinan + dbkeep) — guard anti
//     "diklaim tapi tidak ditulis" seperti pelajaran run-6.
//
// Standar: Bahasa Indonesia, stdlib Node + vitest saja.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatUkuran,
  labelNode,
  pesanSebab,
  type PindahanNode,
} from "@/lib/backup";

const ROOT_FRONTEND = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_REPO = join(ROOT_FRONTEND, "..");
const baca = (rel: string) => readFileSync(join(ROOT_FRONTEND, rel), "utf-8");
const bacaRepo = (rel: string) => readFileSync(join(ROOT_REPO, rel), "utf-8");

describe("formatUkuran — byte menjadi ukuran manusiak", () => {
  it("byte kecil tetap satuan B", () => {
    expect(formatUkuran(0)).toBe("0 B");
    expect(formatUkuran(512)).toBe("512 B");
  });
  it("kilobyte dibulatkan", () => {
    expect(formatUkuran(2048)).toBe("2 KB");
    expect(formatUkuran(90 * 1024)).toBe("90 KB");
  });
  it("megabyte satu koma Indonesia", () => {
    expect(formatUkuran(1.2 * 1024 * 1024)).toBe("1,2 MB");
    expect(formatUkuran(5 * 1024 * 1024)).toBe("5,0 MB");
  });
});

describe("labelNode + pesanSebab — terjemahan status untuk UI", () => {
  it("labelNode mengenali pusat dan salinan", () => {
    expect(labelNode("pusat")).toBe("Pusat");
    expect(labelNode("salinan")).toBe("Salinan");
    expect(labelNode("asing")).toBe("Pusat"); // default aman
  });
  it("pesanSebab menerjemahkan failback ber-baris", () => {
    const p: PindahanNode = {
      waktu: "2026-11-17",
      ke: "pusat",
      sebab: "sinkron balik selesai",
      gagal: 0,
      baris: 42,
    };
    expect(pesanSebab(p)).toContain("42 baris");
    expect(pesanSebab(p)).toContain("dipulangkan");
  });
  it("pesanSebab failback tanpa baris tetap bermakna", () => {
    const p: PindahanNode = {
      waktu: "2026-11-17",
      ke: "pusat",
      sebab: "x",
      gagal: 0,
      baris: 0,
    };
    expect(pesanSebab(p)).toContain("Pusat pulih");
  });
  it("pesanSebab failover memakai sebab asli", () => {
    const p: PindahanNode = {
      waktu: "2026-11-17",
      ke: "salinan",
      sebab: "node aktif gagal 3x berturut",
      gagal: 3,
      baris: 0,
    };
    expect(pesanSebab(p)).toBe("node aktif gagal 3x berturut");
  });
});

describe("kontrak JSON backend 2.1.0 dikunci dari sisi frontend", () => {
  it("handler Go memancarkan field yang dibaca lib/backup.ts", () => {
    const handler = bacaRepo("backend/internal/handler/backup.go");
    for (const tag of [
      'json:"node_aktif"',
      'json:"riwayat_pindahan"',
      'json:"backup_terakhir"',
      'json:"salinan_aktif"',
      'json:"backup_interval_s"',
    ]) {
      expect(handler).toContain(tag);
    }
    // daftar berkas: Info di paket backup (nama/ukuran/dibuat)
    const paket = bacaRepo("backend/internal/backup/backup.go");
    for (const tag of ['json:"nama"', 'json:"ukuran"', 'json:"dibuat"']) {
      expect(paket).toContain(tag);
    }
  });
  it("server actions memanggil endpoint admin yang benar", () => {
    const actions = baca("app/owner/settings/backup-actions.ts");
    expect(actions).toContain('"/admin/db-status"');
    expect(actions).toContain('"/admin/backup/run"');
    expect(actions).toContain("`/admin/backup/${encodeURIComponent(nama)}/restore`");
    expect(actions).toContain('"/admin/db/failover"');
    // hanya OWNER/DEVELOPER yang boleh (penjaga di sisi server action)
    expect(actions).toContain("OWNER");
    expect(actions).toContain("DEVELOPER");
  });
  it("halaman Pengaturan memasang BackupForm + membaca status server-side", () => {
    const page = baca("app/owner/settings/page.tsx");
    expect(page).toContain("BackupForm");
    expect(page).toContain("bacaDbStatus");
    expect(page).toContain("/admin/backup");
  });
});

describe("guard anti klaim-kosong run-6 (fitur benar-benar terpasang)", () => {
  it("Dockerfile runtime MURNI GO: tanpa postgresql-client/gzip + folder backups", () => {
    const dockerfile = bacaRepo("backend/Dockerfile");
    // run-8: alat eksternal pg_dump dihapus total (akar "server
    // version mismatch" di mesin pemilik) — dump murni Go. Komentar
    // sejarah BOLEH menyebut nama alatnya; baris pemasangan tidak.
    const barisPaket = dockerfile.split("\n").filter((l) => l.includes("apt-get install"));
    expect(barisPaket.join("\n")).not.toContain("postgresql-client");
    expect(barisPaket.join("\n")).not.toContain("gzip");
    expect(dockerfile).toContain("/app/backups");
  });
  it("internal/schema = satu sumber kebenaran DDL + backup murni Go", () => {
    expect(bacaRepo("backend/internal/schema/schema.go")).toContain(
      "var Pernyataan",
    );
    const backup = bacaRepo("backend/internal/backup/backup.go");
    expect(backup).toContain("func Dump");
    expect(backup).toContain("QueryExecModeSimpleProtocol");
    // tidak boleh ada lagi panggilan alat eksternal (komentar sejarah
    // boleh menyebut pg_dump; panggilan kode tidak).
    expect(backup).not.toContain("exec.LookPath");
    expect(backup).not.toMatch(/exec\.Command[^(]*\([^)]*pg_dump/);
  });

  it("run-10: dump menjaminkan kolom yang dibawanya (ALTER ADD COLUMN IF NOT EXISTS)", () => {
    const backup = bacaRepo("backend/internal/backup/backup.go");
    expect(backup).toContain("ADD COLUMN IF NOT EXISTS");
    expect(
      bacaRepo("backend/internal/backup/backup_test.go"),
    ).toContain("TestDumpMenjaminKolomLegacyDibuat");
  });

  it("run-9: TabelSet menurunkan tabel aplikasi + Dump menyaring tabel legacy", () => {
    // pelajaran run-8: dump membawa INSERT tabel legacy _prisma_migrations
    // tanpa CREATE-nya -> pemulihan ke node kosong gagal 42P01.
    const schema = bacaRepo("backend/internal/schema/schema.go");
    expect(schema).toContain("func TabelSet()");
    expect(schema).toContain("_prisma_migrations"); // disebut sebagai contoh yang ditolak
    const backup = bacaRepo("backend/internal/backup/backup.go");
    expect(backup).toContain("schema.TabelSet()");
    expect(backup).toContain("receipt_seq");
    // regresi permanen ada di paket backup_test.go
    expect(
      bacaRepo("backend/internal/backup/backup_test.go"),
    ).toContain("TestDumpMenolakTabelLegacyPrisma");
  });
  it("compose memasang db-salinan + dbkeep + volume backups", () => {
    const compose = bacaRepo("docker-compose.yml");
    expect(compose).toContain("db-salinan:");
    expect(compose).toContain("dbkeep:");
    expect(compose).toContain("pgdata-salinan:");
    expect(compose).toContain("backups:");
    expect(compose).toContain("DATABASE_REPLICA_URL");
    expect(compose).toContain("POSTGRES_REPLICA_PASSWORD");
  });
  it("dbkeep/node.sh memuat re-clone dari berkas cadangan + catatan zaman-salinan", () => {
    const skrip = bacaRepo("dbkeep/node.sh");
    // run-8: dbkeep tidak memanggil pg_dump — re-clone membaca berkas
    // .sql.gz dari volume backups bersama; zaman-salinan dicatat di
    // log; keputusan failover/sinkron balik milik backend.
    expect(skrip).toContain("umkm-backup-");
    expect(skrip).toContain("zaman-salinan");
    expect(skrip).toContain("flock");
    // pg_dump hanya boleh disebut komentar (#); baris aktif tidak.
    const barisAktif = skrip.split("\n").filter((l) => !l.trimStart().startsWith("#"));
    expect(barisAktif.join("\n")).not.toContain("pg_dump");
  });
  it("selftest --db menguji mesin salinan end-to-end", () => {
    const selftest = bacaRepo("backend/cmd/selftest/main.go");
    expect(selftest).toContain("ujiSalinan");
    expect(selftest).toContain("SALINAN=OK");
    expect(selftest).toContain("zaman-salinan");
  });
  it("selftest --groq mencetak PROBERAW (diagnosis 403 tepi vs kunci)", () => {
    const selftest = bacaRepo("backend/cmd/selftest/main.go");
    expect(selftest).toContain("PROBERAW");
    expect(selftest).toContain("FALLBACK=");
  });
});
