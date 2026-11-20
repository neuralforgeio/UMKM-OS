import { redirect } from "next/navigation";
import { TerminalSquare } from "lucide-react";
import { auth } from "@/lib/auth";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { ShellTabs } from "./shell-tabs";
import { TabBerkas } from "./tab-berkas";
import { TabProses } from "./tab-proses";
import { TabTerminal } from "./tab-terminal";
import { TabEnv } from "./tab-env";
import { TabNet } from "./tab-net";
import { TabServer } from "./tab-server";

export const instant = false;

// UMKM2SHELL (v1.6.0 / backend 2.3.0): kontrol penuh server untuk
// developer — lima tab: Berkas (penjara), Proses, Terminal
// (whitelist + antrian), Lingkungan (rahasia mask), Jaringan.
// Semua pintu ter-audit di backend; dokumentasi docs/api/.
export default async function ShellPage() {
  const session = await auth();
  const user = userMenuUser(session);
  if (!user || user.role !== "DEVELOPER") redirect("/login");

  const outlet = await getOutletContext();

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
      title="UMKM2Shell"
      subtitle="Kontrol penuh server — berkas, proses, terminal, env, jaringan"
    >
      <ShellTabs
        berkas={<TabBerkas goToken={session?.user?.goToken ?? ""} />}
        proses={<TabProses goToken={session?.user?.goToken ?? ""} />}
        terminal={<TabTerminal goToken={session?.user?.goToken ?? ""} />}
        env={<TabEnv goToken={session?.user?.goToken ?? ""} />}
        net={<TabNet goToken={session?.user?.goToken ?? ""} />}
        server={<TabServer goToken={session?.user?.goToken ?? ""} />}
      />
    </AppShell>
  );
}
