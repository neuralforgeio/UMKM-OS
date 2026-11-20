"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  Pencil,
  Trash2,
} from "lucide-react";

// TAB 1 UMKM2Shell: PENJELAJAH BERKAS dalam penjara.
// ls GET /shell/fs?path= · cat GET /shell/fs/cat · unduh GET
// /shell/fs/unduh · tulis PUT /shell/fs · hapus DELETE /shell/fs.
const API = process.env.API_URL ?? "http://localhost:8080";

type Entri = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mode: string;
  mod_time: string;
};

export function TabBerkas({ goToken }: { goToken: string }) {
  const [path, setPath] = useState("");
  const [entri, setEntri] = useState<Entri[]>([]);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<{
    path: string;
    isi: string;
    terpotong: boolean;
  } | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(
    async (p: string) => {
      setPesan(null);
      setPratinjau(null);
      const res = await fetch(
        `${API}/api/v1/shell/fs?path=${encodeURIComponent(p)}`,
        { headers: { Authorization: `Bearer ${goToken}` } },
      );
      const json = (await res.json()) as {
        success: boolean;
        data?: { entri: Entri[] };
        error?: { message: string };
      };
      if (!json.success || !json.data) {
        setPesan(json.error?.message ?? "gagal memuat");
        return;
      }
      setEntri(json.data.entri);
      setPath(p);
    },
    [goToken],
  );

  useEffect(() => {
    void muat("");
  }, [muat]);

  const naik = () => {
    if (path === "") return;
    const atas = path.split("/").slice(0, -1).join("/");
    void muat(atas);
  };

  const buka = (e: Entri) => {
    if (e.is_dir) void muat(e.path);
    else void lihat(e.path);
  };

  const lihat = async (p: string) => {
    setPesan(null);
    const res = await fetch(
      `${API}/api/v1/shell/fs/cat?path=${encodeURIComponent(p)}`,
      { headers: { Authorization: `Bearer ${goToken}` } },
    );
    const json = (await res.json()) as {
      success: boolean;
      data?: { isi: string; terpotong: boolean };
      error?: { message: string };
    };
    if (!json.success || !json.data) {
      setPesan(json.error?.message ?? "gagal membaca");
      return;
    }
    setPratinjau({ path: p, isi: json.data.isi, terpotong: json.data.terpotong });
  };

  const simpanPratinjau = async () => {
    if (!pratinjau) return;
    setMenyimpan(true);
    try {
      const res = await fetch(`${API}/api/v1/shell/fs`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${goToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: pratinjau.path, isi: pratinjau.isi }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: { message: string };
      };
      setPesan(json.success ? "tersimpan" : (json.error?.message ?? "gagal"));
    } finally {
      setMenyimpan(false);
    }
  };

  const unduh = async (p: string) => {
    const res = await fetch(
      `${API}/api/v1/shell/fs/unduh?path=${encodeURIComponent(p)}`,
      { headers: { Authorization: `Bearer ${goToken}` } },
    );
    if (!res.ok) {
      setPesan(`unduh gagal (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = p.split("/").pop() ?? "berkas";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hapus = async (p: string) => {
    if (!confirm(`Hapus ${p}?`)) return;
    const res = await fetch(
      `${API}/api/v1/shell/fs?path=${encodeURIComponent(p)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${goToken}` } },
    );
    const json = (await res.json()) as {
      success: boolean;
      error?: { message: string };
    };
    setPesan(json.success ? "terhapus" : (json.error?.message ?? "gagal"));
    void muat(path);
  };

  return (
    <div className="space-y-3">
      {pesan && (
        <p className="rounded-lg border border-sky-400/40 bg-sky-400/10 p-3 text-sm">
          {pesan}
        </p>
      )}
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3 font-mono text-sm">
        <button onClick={naik} disabled={path === ""}
          className="rounded-lg border px-2 py-1 disabled:opacity-30"
          title="naik satu tingkat">
          <ChevronRight className="size-4 rotate-[-90deg]" />
        </button>
        <span className="text-muted-foreground">penjara:/</span>
        <span className="font-semibold">{path || ""}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Nama</th>
                <th className="p-3">Ukuran</th>
                <th className="p-3">Modus</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {entri.map((e) => (
                <tr
                  key={e.path}
                  className="cursor-pointer border-t odd:bg-muted/20 [&:hover]:bg-muted/40"
                  onClick={() => buka(e)}
                >
                  <td className="flex items-center gap-2 p-3">
                    {e.is_dir ? (
                      <Folder className="size-4 text-sky-500" />
                    ) : (
                      <FileText className="size-4 text-muted-foreground" />
                    )}
                    <span className="font-mono">{e.name}</span>
                  </td>
                  <td className="p-3 tabular-nums text-muted-foreground">
                    {e.is_dir ? "—" : `${e.size} B`}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {e.mode}
                  </td>
                  <td className="p-3 text-right">
                    {!e.is_dir && (
                      <span className="inline-flex gap-1" onClick={(ev) => ev.stopPropagation()}>
                        {/* unduhan lewat pintu ber-pemantau fetch di bawah (anchor tidak bisa bawa header) */}
                        <button onClick={() => void unduh(e.path)}
                          title="unduh"
                          className="rounded border px-1.5 py-1 text-xs">
                          <Download className="size-3.5" />
                        </button>
                        <button onClick={() => void lihat(e.path)}
                          title="lihat / edit"
                          className="rounded border px-1.5 py-1 text-xs">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => void hapus(e.path)}
                          title="hapus"
                          className="rounded border border-rose-400/50 px-1.5 py-1 text-xs text-rose-600">
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pratinjau && (
          <div className="space-y-2 rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold">
                {pratinjau.path}
              </span>
              <button
                onClick={simpanPratinjau}
                disabled={menyimpan}
                className="rounded-lg border border-sky-400/60 px-3 py-1 text-xs font-medium text-sky-600 hover:bg-sky-400/10 disabled:opacity-40">
                {menyimpan ? "menyimpan…" : "Simpan"}
              </button>
            </div>
            <textarea
              value={pratinjau.isi}
              onChange={(e) =>
                setPratinjau({ ...pratinjau, isi: e.target.value })
              }
              spellCheck={false}
              rows={14}
              className="w-full resize-y rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100"
            />
            {pratinjau.terpotong && (
              <p className="text-xs text-amber-600">
                berkas terpotong di 512 KB — unduh untuk isi penuh
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
