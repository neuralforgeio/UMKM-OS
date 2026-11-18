import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { PengaturanClient } from "./pengaturan-client";

export const instant = false;

type PengaturanBaris = {
  key: string;
  type: string;
  value: string;
  default: string;
  updated_by: string;
  updated_at: string;
  keterangan: string;
};

// REGISTRI PENGATURAN (v1.5.0): kunci TERDAFTAR saja — nilai DB
// menang atas env, tervalidasi tipe keras di backend. Rahasia
// (JWT_SECRET dsb.) sengaja tidak masuk registri.
export default async function PengaturanPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();
  const goToken = session?.user?.goToken ?? "";
  const hasil = await goFetch<{ settings: PengaturanBaris[] }>(
    goToken,
    "/admin/settings",
  );
  const pengaturan = hasil.ok ? hasil.data.settings : [];

  return (
    <AppShell
      role="DEVELOPER"
      user={user}
      outlet={{
        name: outlet?.name ?? "Konsol Developer",
        logoUrl: outlet ? outletLogoUrl(outlet) : null,
        address: outlet?.address ?? null,
      }}
      crumb="Gerbang Developer"
      title="Pengaturan"
      subtitle="Registri kunci terdaftar dengan validasi tipe"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <Settings2 className="size-7 text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Registri Pengaturan
            </h1>
            <p className="text-sm text-muted-foreground">
              Kunci terdaftar dengan validasi tipe; nilai database menang
              atas .env tanpa membangun ulang image.
            </p>
          </div>
        </header>
        <PengaturanClient baris={pengaturan} goToken={goToken} />
      </div>
    </AppShell>
  );
}
