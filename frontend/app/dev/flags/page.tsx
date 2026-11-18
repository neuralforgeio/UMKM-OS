import { redirect } from "next/navigation";
import { Flag } from "lucide-react";
import { auth } from "@/lib/auth";
import { goFetch } from "@/lib/api";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { BenderaClient } from "./bendera-client";

export const instant = false;

type BenderaBaris = {
  key: string;
  value: boolean;
  updated_by: string;
  updated_at: string;
  keterangan: string;
};

// BENDERA FITUR (v1.5.0): saklar runtime - nyalakan/mati tanpa
// restart. Hanya kunci terdaftar di backend (bendera yatim ditolak
// dua sisi: Go 400, UI tak menawarkan).
export default async function BenderaPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();
  const goToken = session?.user?.goToken ?? "";
  const hasil = await goFetch<{ flags: BenderaBaris[] }>(goToken, "/admin/flags");
  const flags = hasil.ok ? hasil.data.flags : [];

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
      title="Bendera Fitur"
      subtitle="Saklar runtime tanpa restart container"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6">
        <header className="flex items-center gap-3">
          <Flag className="size-7 text-sky-500" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bendera Fitur</h1>
            <p className="text-sm text-muted-foreground">
              Saklar runtime: efek instan tanpa restart container; nilai
              tersimpan di database dan ikut tercadangkan.
            </p>
          </div>
        </header>
        <BenderaClient baris={flags} goToken={goToken} />
      </div>
    </AppShell>
  );
}
