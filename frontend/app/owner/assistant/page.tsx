import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOutletContext, outletLogoUrl } from "@/lib/outlet-context";
import { OSCAR_LONG_NAME, OSCAR_NAME } from "@/lib/oscar";
import { AppShell } from "@/components/shell/app-shell";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { userMenuUser } from "@/lib/session-user";

export const instant = false;

// Halaman OSCAR UMKM OS v1.1.0: MURNI obrolan AI.
//
// Perubahan besar v1.1.0 (permintaan pemilik):
//  * Dua panel penjelas di sisi kanan dihapus total. Nama model yang
//    dipakai OSCAR tidak lagi dilampirkan ke halaman obrolan;
//    identitas asisten cukup nama OSCAR + nama panjangnya di topbar
//    (judul halaman). Kebijakan privasi dan validasi angka tetap
//    diterapkan oleh layanan ML di sisi server, bukan dipajang.
//  * Tata letak mengikuti obrolan AI pada umumnya: satu kolom obrolan
//    terpusat (maksimal 3xl) dengan panel setinggi viewport, tanpa
//    panel samping, sehingga obrolan terasa seperti aplikasi chat.
//  * Jawaban template tanpa AI sudah dimatikan di layanan ML: bila AI
//    tidak bisa dihubungi, pengguna melihat pesan galat jujur di dalam
//    obrolan (dengan tombol kirim ulang), bukan jawaban palsu.
//
// Gerbang lama tetap: hanya pemilik dan developer yang boleh membuka
// halaman ini; kasir diarahkan ke aplikasi kasir.

export default async function HalamanAsisten() {
  const session = await auth();
  if (!session?.user?.goToken) redirect("/login");
  if (session.user.role !== "OWNER" && session.user.role !== "DEVELOPER") {
    redirect("/cashier");
  }

  const outlet = await getOutletContext();
  const namaOutlet = outlet?.name ?? "Warung Anda";

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
      {/* Satu kolom obrolan terpusat ala aplikasi chat AI pada umumnya.
          OSCAR sendiri yang memperkenalkan penciptanya bila ditanya
          (persona layanan ML), tidak dipajang di halaman. */}
      <div className="mx-auto w-full max-w-3xl">
        <AssistantPanel outletName={namaOutlet} />
      </div>
    </AppShell>
  );
}
