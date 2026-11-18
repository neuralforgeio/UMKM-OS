import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { SesiClient } from "./sesi-client";

export const instant = false;

type SesiBaris = {
  id: string;
  user_id: number;
  user_name: string;
  user_role: string;
  ip: string;
  user_agent: string;
  created_at: string;
  last_seen: string;
  expires_at: string;
  revoked_at?: string | null;
};

// SESI AKTIF (v1.5.0 Gerbang Developer): seluruh sesi login 24 jam
// terakhir lintas peran + tombol TENDANG. Menendang = mencabut token
// seketika (backend 2.2.0 menolak token ber-sid yang barisnya sudah
// dicabut). Sesi sendiri tak bisa ditendang — backend menolaknya.
export default async function SesiPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();
  const goToken = session?.user?.goToken ?? "";
  const hasil = await goFetch<{ sessions: SesiBaris[]; total: number }>(
    goToken,
    "/admin/sessions",
  );
  const sesi = hasil.ok ? hasil.data : { sessions: [], total: 0 };

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
      title="Sesi Aktif"
      subtitle="Tendang sesi login lintas peran seketika"
    >
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <Users className="size-7 text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sesi Aktif</h1>
            <p className="text-sm text-muted-foreground">
              {sesi.total} sesi 24 jam terakhir — tendang mencabut token
              seketika tanpa menunggu kadaluarsa.
            </p>
          </div>
        </header>
        <SesiClient
          baris={sesi.sessions.map((s) => ({
            ...s,
            pendapatan: s.user_agent.slice(0, 60),
          }))}
          goToken={goToken}
        />
      </div>
    </AppShell>
  );
}
