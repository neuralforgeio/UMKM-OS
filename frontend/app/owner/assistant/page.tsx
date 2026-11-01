import { redirect } from "next/navigation";
import { Database, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import { getAssistantLlmConfig } from "@/lib/assistant";
import {
  OSCAR_CREATOR,
  OSCAR_LONG_NAME,
  OSCAR_NAME,
  OSCAR_ORIGIN,
} from "@/lib/oscar";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { UiAlert } from "@/components/ui/alert";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { userMenuUser } from "@/lib/session-user";

export const instant = false;

// Halaman OSCAR UMKM OS v1.0.0.
//
// PERBAIKAN judul halaman (permintaan pemilik): topbar kini memuat nama
// panjang OSCAR (Online Shop Center for Assistance & Response) sebagai
// subjudul di bawah judul "OSCAR". Nama panjang yang sama tampil di kepala panel obrolan
// sehingga identitas asisten tidak pernah samar.
//
// Sisi kanan memuat konteks bisnis NYATA (mode jawaban dan model dibaca
// dari pengaturan layanan ML) serta aturan main OSCAR yang memang
// diterapkan sistem (hanya data outlet sendiri, keputusan tetap milik
// pemilik, kunci tidak pernah dibocorkan).

export default async function HalamanAsisten() {
  const session = await auth();
  if (!session?.user?.goToken) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  const outlet = await getOutletContext();
  const namaOutlet = outlet?.name ?? "Warung Anda";

  let modeJawaban: "ai" | "data" | null = null;
  let namaModel: string | null = null;
  try {
    const cfg = await getAssistantLlmConfig();
    modeJawaban = cfg.mode;
    namaModel = cfg.llm_model;
  } catch {
    // Layanan ML tidak terjangkau, konteks tampil jujur tanpa mode.
  }

  return (
    <AppShell
      role={session.user.role === "DEVELOPER" ? "DEVELOPER" : "OWNER"}
      user={userMenuUser(session)}
      outlet={{
        name: namaOutlet,
        logoUrl: outlet ? outletLogoUrl(outlet) : null,
        address: outlet?.address ?? null,
      }}
      crumb="Pengelolaan"
      title={OSCAR_NAME}
      subtitle={OSCAR_LONG_NAME}
    >
      <PageHeader
        eyebrow="Asisten bisnis"
        title={`${OSCAR_NAME} (${OSCAR_LONG_NAME})`}
        description={`Asisten bisnis UMKM OS yang menjawab dari data ${namaOutlet}. Diciptakan oleh ${OSCAR_CREATOR} dari ${OSCAR_ORIGIN}.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <AssistantPanel outletName={namaOutlet} />

        <div className="grid content-start gap-4">
          <Panel title="Konteks bisnis" subtitle="Keadaan asisten saat halaman ini dibuka">
            <ul className="grid gap-3 text-xs">
              <li className="flex items-center justify-between gap-3">
                <span className="text-shell-muted">Outlet aktif</span>
                <span className="truncate font-semibold text-shell-ink">
                  {namaOutlet}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-shell-muted">Sumber data</span>
                <span className="text-right font-semibold text-shell-ink">
                  Penjualan, stok, produk, ramalan
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-shell-muted">Mode jawaban</span>
                {modeJawaban === "ai" ? (
                  <StatusPill tone="ok">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Mode AI
                  </StatusPill>
                ) : modeJawaban === "data" ? (
                  <StatusPill tone="netral">
                    <Database className="mr-1 h-3 w-3" />
                    Mode Data
                  </StatusPill>
                ) : (
                  <StatusPill tone="warn">Tidak terbaca</StatusPill>
                )}
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-shell-muted">Model</span>
                <span className="truncate font-semibold text-shell-ink">
                  {namaModel ?? "Belum dipilih"}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-shell-muted">Batas laju</span>
                <span className="font-semibold text-shell-ink">
                  12 pertanyaan per jam per pengguna
                </span>
              </li>
            </ul>
          </Panel>

          <Panel title={`Aturan main ${OSCAR_NAME}`} subtitle="Diterapkan langsung oleh sistem">
            <ol className="grid gap-2.5 text-[11px] leading-relaxed text-shell-ink-soft">
              <li className="flex gap-2">
                <span className="font-bold text-shell-primary-strong">1.</span>
                Menjawab hanya dari data outlet yang sedang aktif; permintaan
                data toko lain ditolak sopan.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-shell-primary-strong">2.</span>
                Keputusan finansial tetap di tangan pemilik; saran OSCAR
                bersifat bantuan, bukan perintah.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-shell-primary-strong">3.</span>
                Angka pada jawaban divalidasi terhadap data; angka yang belum
                lolos validasi ditandai peringatan.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-shell-primary-strong">4.</span>
                Kunci API dan kredensial tidak pernah dibocorkan dalam
                percakapan.
              </li>
            </ol>
          </Panel>

          {modeJawaban === "data" && (
            <UiAlert variant="peringatan" title="Mode Data sedang aktif">
              OSCAR saat ini menjawab dari data toko tanpa bantuan model
              bahasa. Aktifkan Mode AI melalui Pengaturan untuk jawaban yang
              lebih luas cakupannya.
            </UiAlert>
          )}
        </div>
      </div>
    </AppShell>
  );
}
