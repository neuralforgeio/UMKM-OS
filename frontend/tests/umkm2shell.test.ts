import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GUARD UMKM2SHELL (v1.6.0 / backend 2.3.0) — permintaan pemilik:
// fitur panel ala PHP2Shell/NodeJS2Shell, jauh lebih complex, WAJIB
// unit testing per fitur, SEMUA API WAJIB ada berkas docs.
// Tes ini mengunci kelima fitur dari sisi repositori.

function bacaRepo(rel: string): string {
  return readFileSync(join(process.cwd(), "..", rel), "utf-8");
}

describe("umkm2shell backend — lima fitur package shell", () => {
  it("fs: penjara + tolak .. SEBELUM Clean + batas baca", () => {
    const fs = bacaRepo("backend/internal/shell/fs.go");
    expect(fs).toContain("func Bersihkan");
    expect(fs).toContain("func Ls");
    expect(fs).toContain("func Cat");
    expect(fs).toContain("func Unduh");
    expect(fs).toContain("func Tulis");
    expect(fs).toContain("func Hapus");
    expect(fs).toContain("func GantiNama");
    // akar galat a/../../etc: cek .. harus SEBELUM filepath.Clean
    const idxCek = fs.indexOf('strings.Contains(rel, "..")');
    const idxClean = fs.indexOf("filepath.Clean(");
    expect(idxCek).toBeGreaterThan(0);
    expect(idxClean).toBeGreaterThan(0);
    expect(idxCek).toBeLessThan(idxClean);
  });

  it("proc: pagar bunuh diri + pid 1 + sinyal terbatas", () => {
    const p = bacaRepo("backend/internal/shell/proc.go");
    expect(p).toContain("func DaftarProses");
    expect(p).toContain("func StatistikSistem");
    expect(p).toContain("func KirimSinyal");
    expect(p).toContain("PIDSendiri()");
    expect(p).toContain("SIGTERM");
  });

  it("cmd: whitelist + blacklist + antrian + interupsi + sejarah", () => {
    const c = bacaRepo("backend/internal/shell/cmd.go");
    expect(c).toContain("PERINTAH_PUTIH");
    expect(c).toContain("KATA_HITAM");
    expect(c).toContain("func ValidasiPerintah");
    expect(c).toContain("func Jalankan");
    expect(c).toContain("func Interupsi");
    expect(c).toContain("func Sejarah");
    // git dibatasi status/log/diff
    expect(c).toContain('case "status", "log", "diff":');
  });

  it("env: mask rahasia + buka satu kunci", () => {
    const e = bacaRepo("backend/internal/shell/env.go");
    expect(e).toContain("POLA_RAHASIA");
    expect(e).toContain("func MaskNilai");
    expect(e).toContain("func DaftarEnv");
    expect(e).toContain("NEXT_PUBLIC_API_URL");
  });

  it("net: ping TCP + HEAD tanpa redirect + skema http(s) saja", () => {
    const n = bacaRepo("backend/internal/shell/net.go");
    expect(n).toContain("func PingTCP");
    expect(n).toContain("func HttpHead");
    expect(n).toContain("http.ErrUseLastResponse");
    expect(n).toContain("http://");
  });

  it("15 rute /shell/* terpasang di grup DEVELOPER", () => {
    const m = bacaRepo("backend/main.go");
    for (const rute of [
      "/shell/fs", "/shell/fs/cat", "/shell/fs/unduh",
      "/shell/fs/ganti-nama", "/shell/proc", "/shell/proc/sinyal",
      "/shell/cmd", "/shell/cmd/interupsi", "/shell/cmd/daftar",
      "/shell/env", "/shell/net/ping", "/shell/net/http",
    ]) {
      expect(m).toContain(`"${rute}"`);
    }
    const grup = m.slice(m.indexOf('RequireRoleIn("DEVELOPER")'));
    expect(grup).toContain("/shell/cmd");
  });

  it("handler shell: semua pintu + audit SHELL_*", () => {
    const h = bacaRepo("backend/internal/handler/shell.go");
    for (const fn of [
      "ShellFsLs", "ShellFsCat", "ShellFsUnduh", "ShellFsTulis",
      "ShellFsHapus", "ShellFsGantiNama", "ShellProcList",
      "ShellProcSinyal", "ShellCmdJalankan", "ShellCmdSejarah",
      "ShellCmdInterupsi", "ShellCmdDaftar", "ShellEnv",
      "ShellNetPing", "ShellNetHttp",
    ]) {
      expect(h).toContain(`func ${fn}`);
    }
    expect(h).toContain("SHELL_FS_");
    expect(h).toContain("SHELL_CMD_");
    expect(h).toContain("SHELL_ENV_BUKA");
  });
});

describe("umkm2shell — unit testing per fitur (wajib pemilik)", () => {
  it("lima berkas *_test.go ada dan memuat tes nyata", () => {
    const tes = bacaRepo("backend/internal/shell/fs_test.go");
    expect(tes).toContain("TestBersihkanTakPernahKeluarJail");
    expect(bacaRepo("backend/internal/shell/proc_test.go")).toContain(
      "TestKirimSinyalDiriSendiriDitolak",
    );
    expect(bacaRepo("backend/internal/shell/cmd_test.go")).toContain(
      "TestValidasiPerintahPutihHitam",
    );
    expect(bacaRepo("backend/internal/shell/env_test.go")).toContain(
      "TestDaftarEnvMaskKecualiBuka",
    );
    expect(bacaRepo("backend/internal/shell/net_test.go")).toContain(
      "TestHttpHeadTidakIkutRedirect",
    );
  });
});

describe("umkm2shell — dokumentasi API (wajib pemilik)", () => {
  it("tiga berkas docs shell + README indeks ada", () => {
    for (const f of [
      "shell-fs.md",
      "shell-proc-cmd.md",
      "shell-env-net.md",
    ]) {
      const isi = bacaRepo(`backend/docs/api/${f}`);
      expect(isi.length).toBeGreaterThan(800);
      expect(isi).toContain("/api/v1/shell");
    }
    const idx = bacaRepo("backend/docs/api/README.md");
    expect(idx).toContain("shell-fs.md");
  });

  it("dokumen shell memuat SEMUA endpoint + contoh + galat", () => {
    const fsDoc = bacaRepo("backend/docs/api/shell-fs.md");
    for (const ep of [
      "GET /api/v1/shell/fs?path=",
      "GET /api/v1/shell/fs/cat?path=",
      "GET /api/v1/shell/fs/unduh?path=",
      "PUT /api/v1/shell/fs",
      "DELETE /api/v1/shell/fs?path=",
      "PUT /api/v1/shell/fs/ganti-nama",
    ]) {
      expect(fsDoc).toContain(ep);
    }
    expect(fsDoc).toContain("Authorization: Bearer");
    expect(fsDoc).toContain("```json");

    const pcDoc = bacaRepo("backend/docs/api/shell-proc-cmd.md");
    for (const ep of [
      "GET /api/v1/shell/proc",
      "POST /api/v1/shell/proc/sinyal",
      "POST /api/v1/shell/cmd",
      "GET /api/v1/shell/cmd",
      "POST /api/v1/shell/cmd/interupsi",
      "GET /api/v1/shell/cmd/daftar",
    ]) {
      expect(pcDoc).toContain(ep);
    }

    const enDoc = bacaRepo("backend/docs/api/shell-env-net.md");
    expect(enDoc).toContain("GET /api/v1/shell/env?buka=KUNCI");
    expect(enDoc).toContain("POST /api/v1/shell/net/ping");
    expect(enDoc).toContain("POST /api/v1/shell/net/http");
  });

  it("12 dokumen api total + indeks menautkan tanpa tautan mati shell", () => {
    const idx = bacaRepo("backend/docs/api/README.md");
    const tautan = idx.match(/\]\(([a-z-]+\.md)\)/g) ?? [];
    expect(tautan.length).toBeGreaterThanOrEqual(12);
    for (const t of tautan) {
      const nama = t.slice(1, -1).replace("(", "").replace(")", "");
      expect(() =>
        readFileSync(join(process.cwd(), "..", "backend", "docs", "api", nama)),
      ).not.toThrow();
    }
  });
});

describe("umkm2shell frontend — halaman lima tab", () => {
  it("berkas halaman + lima tab ada", () => {
    for (const f of [
      "page.tsx",
      "shell-tabs.tsx",
      "tab-berkas.tsx",
      "tab-proses.tsx",
      "tab-terminal.tsx",
      "tab-env.tsx",
      "tab-net.tsx",
    ]) {
      expect(() =>
        readFileSync(join(process.cwd(), "app/dev/shell", f)),
      ).not.toThrow();
    }
  });

  it("tiap tab memanggil endpoint shell yang benar", () => {
    expect(
      readFileSync(join(process.cwd(), "app/dev/shell/tab-berkas.tsx"), "utf-8"),
    ).toContain("/shell/fs");
    expect(
      readFileSync(join(process.cwd(), "app/dev/shell/tab-proses.tsx"), "utf-8"),
    ).toContain("/shell/proc/sinyal");
    expect(
      readFileSync(join(process.cwd(), "app/dev/shell/tab-terminal.tsx"), "utf-8"),
    ).toContain("/shell/cmd");
    expect(
      readFileSync(join(process.cwd(), "app/dev/shell/tab-env.tsx"), "utf-8"),
    ).toContain("?buka=");
    expect(
      readFileSync(join(process.cwd(), "app/dev/shell/tab-net.tsx"), "utf-8"),
    ).toContain("/shell/net/ping");
  });

  it("navigasi memuat menu UMKM2Shell", () => {
    const nav = readFileSync(join(process.cwd(), "lib/shell-nav.ts"), "utf-8");
    expect(nav).toContain('"/dev/shell"');
    expect(nav).toContain("UMKM2Shell");
  });

  it("halaman hanya untuk DEVELOPER", () => {
    const page = readFileSync(join(process.cwd(), "app/dev/shell/page.tsx"), "utf-8");
    expect(page).toContain('user.role !== "DEVELOPER"');
  });
});
