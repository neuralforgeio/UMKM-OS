"use client";

import { useState } from "react";
import { FolderOpen, Gauge, Server, TerminalSquare, ToggleRight, Wifi } from "lucide-react";

// Kerangka tab UMKM2Shell: satu state tab, isi = elemen React yang
// diinjeksi page (server) — client ringan tanpa data ganda.
export function ShellTabs({
  berkas,
  proses,
  terminal,
  env,
  net,
  server,
}: {
  berkas: React.ReactNode;
  proses: React.ReactNode;
  terminal: React.ReactNode;
  env: React.ReactNode;
  net: React.ReactNode;
  server: React.ReactNode;
}) {
  const [tab, setTab] = useState("berkas");
  const TABS = [
    { id: "berkas", label: "Berkas", ikon: FolderOpen, isi: berkas },
    { id: "proses", label: "Proses", ikon: Gauge, isi: proses },
    { id: "terminal", label: "Terminal", ikon: TerminalSquare, isi: terminal },
    { id: "env", label: "Lingkungan", ikon: ToggleRight, isi: env },
    { id: "net", label: "Jaringan", ikon: Wifi, isi: net },
    { id: "server", label: "Server", ikon: Server, isi: server },
  ];
  const aktif = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6">
      <nav className="flex flex-wrap gap-1 rounded-xl border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-sky-600 text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <t.ikon className="size-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>
      <div>{aktif.isi}</div>
    </div>
  );
}
