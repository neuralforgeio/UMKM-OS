// Test penjaga "Era Go Murni" (frontend 1.3.0).
//
// Era v2.1.0 menutup dunia Prisma; era 1.3.0 menutup dunia PYTHON:
// tidak ada lagi layanan FastAPI/requirements.txt/backend-go — folder
// backend-go sudah di-rename menjadi backend dan seluruh fitur AI
// (OSCAR, Developer AI, ramalan) hidup di dalamnya. Test ini memindai
// kode sumber + compose setiap kali vitest jalan supaya dunia-dua-meja
// yang sudah ditutup tidak bisa diam-diam dibuka kembali.
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

  it("backend kini Go murni: tidak ada Python, tidak ada backend-go", () => {
    // Satu-satunya backend adalah folder `backend` ber-Go.mod.
    expect(existsSync(join(root, "..", "backend", "go.mod"))).toBe(true);
    expect(existsSync(join(root, "..", "backend", "main.go"))).toBe(true);
    // Jejak Python harus benar-benar hilang dari repo.
    expect(existsSync(join(root, "..", "backend", "requirements.txt"))).toBe(false);
    expect(existsSync(join(root, "..", "backend", "app"))).toBe(false);
    expect(existsSync(join(root, "..", "backend", "run.py"))).toBe(false);
    expect(existsSync(join(root, "..", "backend", "pytest.ini"))).toBe(false);
    // Nama folder lama tidak boleh kembali.
    expect(existsSync(join(root, "..", "backend-go"))).toBe(false);

    const compose = readFileSync(join(root, "..", "docker-compose.yml"), "utf8");
    // Service backend dibangun dari ./backend (bukan ./backend-go).
    expect(compose).toContain("build: ./backend");
    expect(compose).not.toContain("backend-go");
    // Tidak ada lagi layanan FastAPI/Prophet/mlmodels.
    expect(compose).not.toContain("FastAPI");
    expect(compose).not.toContain("mlmodels");
    expect(compose).not.toContain("PROPHET_ENABLED");
  });

  it("healthcheck tenang v1.1.1: interval 60 detik + start_interval saat boot", () => {
    const compose = readFileSync(join(root, "..", "docker-compose.yml"), "utf8");
    // Probe keadaan stabil hanya tiap 60 detik (dulu 5-10 detik
    // sepanjang hari - itulah yang memberatkan laptop pemilik).
    expect(compose).toContain("interval: 60s");
    expect(compose).toContain("start_interval:");
    expect(compose).not.toContain("interval: 5s");
    expect(compose).not.toContain("interval: 10s");
    // Boot tetap cepat: probe rapat hanya selama start_period.
    expect(compose).toContain("start_period: 30s");
  });

  it("probe /health tidak lagi menulis baris log backend (v1.1.1)", () => {
    const mw = readFileSync(
      join(root, "..", "backend", "internal", "middleware", "middleware.go"),
      "utf8",
    );
    // Middleware Logger melewatkan GET /health tanpa mencatat, supaya
    // volume gologs tidak dipukul 3 baris per probe sepanjang hari.
    expect(mw).toContain('r.URL.Path == "/health"');
    expect(mw).not.toMatch(/HTTPReq[^\n]*health/);
  });
});
