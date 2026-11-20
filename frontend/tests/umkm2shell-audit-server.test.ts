import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// GUARD RUN-13 (v1.7.0 / backend 2.4.0) — permintaan pemilik:
// (1) check semua command karena masih ada problem -> AUDIT;
// (2) developer bisa mematikan server, mengendalikan server, membaca
//     indikasi down, PREDIKSI down, buat lebih banyak lagi;
// (3) WAJIB unit testing per fitur.

function bacaRepo(rel: string): string {
  return readFileSync(join(process.cwd(), "..", rel), "utf-8");
}
function bacaFE(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf-8");
}

describe("audit command — 12 temuan dikunci", () => {
  const cmd = bacaRepo("backend/internal/shell/cmd.go");

  it("node & go & env DIHAPUS dari whitelist", () => {
    expect(cmd).toContain('var PERINTAH_PUTIH = map[string]string{');
    // ambil blok map-nya saja supaya tidak ketemu kata di komentar
    const blok = cmd.slice(
      cmd.indexOf("var PERINTAH_PUTIH"),
      cmd.indexOf("var KATA_HITAM"),
    );
    expect(blok).not.toContain('"node"');
    expect(blok).not.toContain('"go"');
    expect(blok).not.toContain('"env"');
  });

  it("ip link hanya show/list; find -delete/-exec diblok", () => {
    expect(cmd).toContain("IP_LINK_VERBA");
    expect(cmd).not.toContain('"set": true');
    expect(cmd).toContain('"-delete"');
    expect(cmd).toContain('"-exec"');
  });

  it("jalur sistem diblok keras", () => {
    expect(cmd).toContain('"/proc"');
    expect(cmd).toContain('"/sys/"');
    expect(cmd).toContain('"/dev/"');
    expect(cmd).toContain('"/root"');
    expect(cmd).toContain("DIR_SENTUH");
  });

  it("semua argumen jalur dijail + cwd exec = jail", () => {
    expect(cmd).toContain("func terlihatJalur");
    expect(cmd).toContain("func jailkanJalur");
    expect(cmd).toContain("cmd.Dir = JailRoot");
  });

  it("output rahasia dimask + tersedia dinamis", () => {
    expect(cmd).toContain("func maskRahasia");
    expect(cmd).toContain("gantiPola");
    expect(cmd).toContain("func DaftarPutihTersedia");
    expect(cmd).toContain("exec.LookPath");
  });
});

describe("audit command — 10 tes regresi ada", () => {
  it("cmd_audit_test.go mengunci setiap temuan", () => {
    const t = bacaRepo("backend/internal/shell/cmd_audit_test.go");
    for (const nama of [
      "TestAuditNodeDanGoDihapus",
      "TestAuditEnvDihapusDariWhitelist",
      "TestAuditFindDeleteExecDiblok",
      "TestAuditIPLinkHanyaBaca",
      "TestAuditJalurSistemDiblokDiArgumen",
      "TestAuditJalurDiubahKeJail",
      "TestAuditCurlOFlagDiblok",
      "TestAuditMaskRahasiaOutput",
      "TestAuditDaftarPutihTersedia",
      "TestAuditCWDPerintahAdalahJail",
    ]) {
      expect(t).toContain(nama);
    }
  });
});

describe("kendali server — fitur 6 (server.go)", () => {
  const srv = bacaRepo("backend/internal/shell/server.go");

  it("matikan server: channel + idempoten + status", () => {
    expect(srv).toContain("var Matikan = make(chan struct{}, 1)");
    expect(srv).toContain("func MatikanServer() bool");
    expect(srv).toContain("func StatusMatikan() bool");
  });

  it("kesehatan: indikator nyata + verdict + parser log CSV", () => {
    expect(srv).toContain("func AmbilKesehatan");
    expect(srv).toContain("func verdictKesehatan");
    expect(srv).toContain("func parseStatHTTP");
    expect(srv).toContain("HIJAU");
    expect(srv).toContain("MERAH");
    expect(srv).toContain("PasangDBPing");
    expect(srv).toContain("PasangGoroutine");
  });

  it("prediksi down: ring + regresi linear + verdict", () => {
    expect(srv).toContain("func PrediksiDown");
    expect(srv).toContain("func kemiringan");
    expect(srv).toContain("CatatSampelOtomatis");
    expect(srv).toContain("SEHAT");
    expect(srv).toContain("KRITIS");
    expect(srv).toContain("WASPADA");
  });

  it("12 tes server ada (wajib unit testing)", () => {
    const t = bacaRepo("backend/internal/shell/server_test.go");
    for (const nama of [
      "TestMatikanServerSekaliSaja",
      "TestParseStatHTTP",
      "TestPersentil",
      "TestKemiringanRegresi",
      "TestVerdictKesehatan",
      "TestVerdictPrediksi",
      "TestPrediksiDownButuhSampel",
      "TestRingPrediksiDanRegresi",
      "TestRingMaksTerpotong",
      "TestMinimum",
      "TestKesehatanLewatDBPingInject",
    ]) {
      expect(t).toContain(nama);
    }
  });
});

describe("rute + integrasi main.go", () => {
  const m = bacaRepo("backend/main.go");

  it("6 rute server/validasi/tersedia terpasang di grup DEVELOPER", () => {
    for (const r of [
      "/shell/server/kesehatan",
      "/shell/server/prediksi",
      "/shell/server/matikan",
      "/shell/server/status",
      "/shell/cmd/validasi",
      "/shell/cmd/tersedia",
    ]) {
      expect(m).toContain(`"${r}"`);
    }
    const grup = m.slice(m.indexOf('RequireRoleIn("DEVELOPER")'));
    expect(grup).toContain("/shell/server/matikan");
  });

  it("matikan tersambung ke loop shutdown + sampler + dbping", () => {
    expect(m).toContain("case <-shell.Matikan:");
    expect(m).toContain("shell.CatatSampelOtomatis()");
    expect(m).toContain("shell.PasangDBPing");
    expect(m).toContain("shell.JailRoot = akar");
    expect(m).toContain("SHELL_JAIL_ROOT");
  });

  it("handler pintu server ada + ter-audit", () => {
    const h = bacaRepo("backend/internal/handler/shell.go");
    for (const fn of [
      "ShellServerKesehatan",
      "ShellServerPrediksi",
      "ShellServerMatikan",
      "ShellServerStatus",
      "ShellCmdValidasi",
      "ShellCmdTersedia",
    ]) {
      expect(h).toContain(`func ${fn}`);
    }
    expect(h).toContain("SHELL_SERVER_MATIKAN");
    expect(h).toContain("MATIKAN");
  });
});

describe("env — DATABASE_URL kini rahasia", () => {
  it("POLA_RAHASIA memuat DATABASE_URL + REPLICA_URL", () => {
    const e = bacaRepo("backend/internal/shell/env.go");
    expect(e).toContain('"DATABASE_URL", "REPLICA_URL"');
  });
});

describe("frontend 1.7.0 — tab Server + terminal dry-run", () => {
  it("tab-server.tsx memanggil 4 pintu server", () => {
    const t = bacaFE("app/dev/shell/tab-server.tsx");
    expect(t).toContain("/shell/server/kesehatan");
    expect(t).toContain("/shell/server/prediksi");
    expect(t).toContain("/shell/server/matikan");
    expect(t).toContain("MATIKAN");
    expect(t).toContain("prompt("); // dialog konfirmasi literal
  });

  it("shell-tabs memuat 6 tab termasuk Server", () => {
    const t = bacaFE("app/dev/shell/shell-tabs.tsx");
    expect(t).toContain('id: "server"');
    expect(t).toContain("server,");
  });

  it("terminal: tersedia dinamis + validasi dry-run", () => {
    const t = bacaFE("app/dev/shell/tab-terminal.tsx");
    expect(t).toContain("/shell/cmd/tersedia");
    expect(t).toContain("/shell/cmd/validasi");
    expect(t).toContain("setValidasi");
    expect(t).not.toContain("${API}/api/v1/shell/cmd/daftar");
  });

  it("changelog 1.7.0 memuat audit + kendali + prediksi", () => {
    const c = bacaFE("lib/changelog.ts");
    const entri = c.slice(
      c.indexOf('versi: "1.7.0"'),
      c.indexOf('versi: "1.6.0"'),
    );
    expect(entri).toContain("audit");
    expect(entri).toContain("matikan server");
    expect(entri).toContain("PREDIKSI DOWN");
    expect(entri).toContain("DRY-RUN");
  });

  it("VERSIONS frontend 1.7.0", () => {
    expect(bacaFE("VERSIONS.csv")).toContain("1.7.0,2026-11-20");
  });
});

describe("dokumentasi API shell-server.md", () => {
  it("semua endpoint baru + tabel audit 12 terdokumentasi", () => {
    const d = bacaRepo("backend/docs/api/shell-server.md");
    for (const ep of [
      "GET /api/v1/shell/server/kesehatan",
      "GET /api/v1/shell/server/prediksi",
      "POST /api/v1/shell/server/matikan",
      "GET /api/v1/shell/server/status",
      "POST /api/v1/shell/cmd/validasi",
      "GET /api/v1/shell/cmd/tersedia",
    ]) {
      expect(d).toContain(ep);
    }
    expect(d).toContain("Perubahan penting whitelist");
    expect(d).toContain("29 biner");
  });

  it("README indeks menautkan shell-server.md", () => {
    expect(bacaRepo("backend/docs/api/README.md")).toContain(
      "shell-server.md",
    );
  });

  it("versi backend 2.4.0", () => {
    expect(bacaRepo("backend/internal/config/config.go")).toContain(
      'const AppVersion = "2.4.0"',
    );
    expect(bacaRepo("backend/VERSIONS.csv")).toContain(
      "2.4.0,2026-11-20",
    );
  });
});
