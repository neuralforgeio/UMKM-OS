// Test penjaga "Era Go Murni" (frontend v2.1.0).
//
// Setelah penghapusan total Prisma, TIDAK ADA file aplikasi yang boleh
// mengimpor klien Prisma lagi — satu-satunya sumber data adalah
// backend-go lewat lib/api.ts (goFetch/goPublic). Test ini memindai
// kode sumber setiap kali vitest jalan: kalau seseorang (atau AI di
// masa depan) tidak sengaja menambahkan `@/lib/prisma`, test gagal
// dengan pesan yang menjelaskan dunia-dua-meja yang baru saja ditutup.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Akhiran file yang dipindai; file lain (gambar, css murni, dll.) tidak
// bisa mengimpor modul TS.
const SCANNED_EXT = new Set([".ts", ".tsx"]);

// Folder yang dikecualikan: artefak build & dependensi (bukan kode kita),
// plus .next cache yang bisa memuat salinan lama.
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "lib/generated",
  ".git",
  "coverage",
]);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (SCANNED_EXT.has(entry.slice(entry.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

describe("penjaga era Go murni (v2.1.0)", () => {
  it("tidak ada file aplikasi yang mengimpor Prisma", () => {
    const offenders: string[] = [];
    const scannedRoots = ["app", "lib", "components"].map((d) => join(root, d));
    for (const dir of scannedRoots) {
      for (const file of collectSourceFiles(dir)) {
        const text = readFileSync(file, "utf8");
        if (/from\s+["']@\/lib\/prisma["']/.test(text)) {
          offenders.push(file);
        }
      }
    }
    expect(
      offenders,
      "Ditemukan import @/lib/prisma — era Prisma sudah ditutup di v2.1.0. " +
        "Semua data wajib lewat backend-go (goFetch di lib/api.ts); " +
        "tabel PascalCase era demo sudah di-DROP permanen.",
    ).toEqual([]);
  });

  it("helper prisma sudah benar-benar dihapus dari repo", () => {
    expect(existsSync(join(root, "lib", "prisma.ts"))).toBe(false);
    expect(existsSync(join(root, "lib", "audit.ts"))).toBe(false);
    expect(existsSync(join(root, "prisma"))).toBe(false);
    expect(existsSync(join(root, "prisma.config.ts"))).toBe(false);
  });

  it("package.json bebas dependensi Prisma", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const prismaDeps = Object.keys(deps).filter((d) => d.includes("prisma"));
    expect(prismaDeps).toEqual([]);
    // Build script tidak lagi menjalankan `prisma generate` dulu.
    expect(pkg.scripts?.build).toBe("next build");
  });

  it("docker-compose tidak lagi menjalankan service migrate/seed", () => {
    const compose = readFileSync(join(root, "..", "docker-compose.yml"), "utf8");
    expect(compose).not.toMatch(/^\s{2}migrate:/m);
    expect(compose).not.toContain("prisma migrate deploy");
    // Frontend container tidak membawa kredensial database: blok layaran
    // frontend (service terakhir sebelum deklarasi volumes) harus steril.
    const frontendIdx = compose.indexOf("\n  frontend:");
    expect(frontendIdx).toBeGreaterThan(0);
    const volumesIdx = compose.indexOf("\nvolumes:", frontendIdx);
    const frontendBlock = compose.slice(
      frontendIdx,
      volumesIdx > frontendIdx ? volumesIdx : undefined,
    );
    expect(frontendBlock).not.toContain("DATABASE_URL");
  });
});
