// Test penjaga terminal jejak audit v2.2.1.
//
// Logika tampilan terminal (lib/audit-terminal.ts) dipisah sengaja
// dari komponen supaya bisa diuji murni: format waktu WIB, rekonstruksi
// perintah PowerShell dari filter aktif (termasuk aturan petik
// tunggal PowerShell), sanitasi baris detail, dan kelengkapan peta
// warna tingkat/peran.
// Standar: Bahasa Indonesia, stdlib Node saja, tanpa DB, tanpa jaringan.
import { describe, expect, it } from "vitest";
import {
  LEVEL_COLOR,
  PS_PROMPT,
  ROLE_COLOR,
  ROLE_COLOR_FALLBACK,
  buildAuditCommand,
  formatTerminalTime,
  terminalDetail,
  terminalEntity,
  terminalLine,
} from "../lib/audit-terminal";

describe("formatTerminalTime — WIB (UTC+7)", () => {
  it("menggeser UTC ke WIB dengan format DD/MM HH:MM:SS", () => {
    // 07:23:05Z = 14:23:05 WIB tanggal yang sama.
    expect(formatTerminalTime("2026-10-26T07:23:05Z")).toBe(
      "26/10 14:23:05",
    );
  });

  it("tanggal ikut bergeser saat UTC masih di hari sebelumnya", () => {
    // 25/10 20:00Z = 26/10 03:00 WIB — tengah malam lewat.
    expect(formatTerminalTime("2026-10-25T20:00:00Z")).toBe(
      "26/10 03:00:00",
    );
  });
});

describe("buildAuditCommand — filter aktif -> perintah PowerShell", () => {
  it("filter kosong: hanya cmdlet + jumlah baris", () => {
    expect(buildAuditCommand({}, 20)).toBe("Get-AuditLog -Top 20");
  });

  it("crossOutlet menambah -AllOutlets (konsol dev lintas outlet)", () => {
    expect(buildAuditCommand({}, 20, true)).toBe(
      "Get-AuditLog -Top 20 -AllOutlets",
    );
  });

  it("semua filter terwakili dengan urutan stabil", () => {
    expect(
      buildAuditCommand(
        {
          level: "GAGAL",
          q: "refund",
          action: "TRANSACTION_REFUND",
          outletName: "Warung Bu Ira",
          actorName: "Owner UMKM",
          from: "2026-10-01",
          to: "2026-10-26",
        },
        20,
      ),
    ).toBe(
      "Get-AuditLog -Top 20 -Level GAGAL -Query 'refund' -Action TRANSACTION_REFUND -Outlet 'Warung Bu Ira' -Actor 'Owner UMKM' -From 2026-10-01 -To 2026-10-26",
    );
  });

  it("id outlet/aktor tanpa nama tetap terwakili sebagai #id", () => {
    expect(buildAuditCommand({ outletId: "3", actorId: "7" }, 20)).toBe(
      "Get-AuditLog -Top 20 -Outlet #3 -Actor #7",
    );
  });

  it("petik tunggal dalam nilai digandakan ala PowerShell", () => {
    expect(buildAuditCommand({ outletName: "Warung Bu'Ira" }, 20)).toBe(
      "Get-AuditLog -Top 20 -Outlet 'Warung Bu''Ira'",
    );
  });

  it("prompt PowerShell konstan dipakai kepala terminal", () => {
    expect(PS_PROMPT).toBe("PS C:\\umkm-os>");
  });
});

describe("terminalLine / terminalDetail / terminalEntity — baris rapi", () => {
  it("detail ber-patah-baris diratakan dan dipotong ber-elipsis", () => {
    expect(terminalDetail("baris1\nbaris2  gap", 40)).toBe(
      "baris1 baris2 gap",
    );
    const panjang = "a".repeat(120);
    const hasil = terminalDetail(panjang, 96);
    expect(hasil.length).toBe(96);
    expect(hasil.endsWith("…")).toBe(true);
  });

  it("detail kosong jatuh ke penanda kosong (em dash)", () => {
    expect(terminalDetail("")).toBe("—");
    expect(terminalDetail("   \n  ")).toBe("—");
  });

  it("entitas gabung entity:id; salah satu kosong tetap terbaca", () => {
    expect(terminalEntity("transaction", "482")).toBe("transaction:482");
    expect(terminalEntity("outlet", "")).toBe("outlet");
    expect(terminalEntity("", "")).toBe("");
  });

  it("aktor kosong -> Sistem; waktu & field terformat lengkap", () => {
    const line = terminalLine({
      id: 1,
      user_name: "",
      user_role: "",
      outlet_name: "",
      action: "AUTH_LOGIN",
      entity: "auth",
      entity_id: "",
      detail: "login sukses",
      created_at: "2026-10-26T07:23:05Z",
    });
    expect(line.actor).toBe("Sistem");
    expect(line.outlet).toBe("");
    expect(line.time).toBe("26/10 14:23:05");
    expect(line.entity).toBe("auth");
    expect(line.detail).toBe("login sukses");
  });

  it("peta warna lengkap: tiga tingkat + tiga peran + fallback", () => {
    expect(Object.keys(LEVEL_COLOR).sort()).toEqual([
      "GAGAL",
      "PERINGATAN",
      "SUKSES",
    ]);
    expect(ROLE_COLOR.OWNER).toContain("sky");
    expect(ROLE_COLOR.KASIR).toContain("emerald");
    expect(ROLE_COLOR.DEVELOPER).toContain("violet");
    expect(ROLE_COLOR_FALLBACK).toContain("slate");
  });
});
