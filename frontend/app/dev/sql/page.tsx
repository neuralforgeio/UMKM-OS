import { redirect } from "next/navigation";
import { TerminalSquare } from "lucide-react";
import { auth } from "@/lib/auth";

import { AppShell } from "@/components/shell/app-shell";
import { getOutletContext } from "@/lib/outlet-context";
import { outletLogoUrl } from "@/lib/outlet-branding";
import { userMenuUser } from "@/lib/session-user";
import { SqlClient } from "./sql-client";

export const instant = false;

// SQL CONSOLE (v1.5.0): kueri HANYA-BACA langsung ke database warung
// — SELECT saja, satu pernyataan, LIMIT dipaksa backend, maks 500
// baris. Setiap kueri ter-audit (SQL_CONSOLE di jejak).
export default async function SqlPage() {
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
      title="SQL Console"
      subtitle="Kueri hanya-baca ke database warung"
    >
      <SqlClient goToken={session?.user?.goToken ?? ""} />
    </AppShell>
  );
}
