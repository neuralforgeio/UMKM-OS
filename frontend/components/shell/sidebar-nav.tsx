"use client";

// Bagian navigasi sidebar UMKM OS v1.0.0.
//
// Item menu datang dari lib/shell-nav.ts (satu sumber kebenaran per
// peran). Saat sidebar diringkatkan, hanya ikon yang tampil pada layar
// lebar dengan tooltip nama menunya; laci ponsel selalu menampilkan
// label penuh.

import Link from "next/link";
import {
  Boxes,
  Calculator,
  Home,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  activeNavHref,
  navSectionsForRole,
  type ShellIcon,
  type ShellRole,
} from "@/lib/shell-nav";

const IKON: Record<ShellIcon, LucideIcon> = {
  home: Home,
  receipt: Receipt,
  shield: ShieldCheck,
  package: Package,
  boxes: Boxes,
  sparkles: Sparkles,
  settings: Settings,
  calculator: Calculator,
  users: Users,
  terminal: Terminal,
};

export function SidebarNavSection({
  role,
  pathname,
  collapsed,
}: {
  role: ShellRole;
  pathname: string;
  collapsed: boolean;
}) {
  const bagian = navSectionsForRole(role);
  const aktif = activeNavHref(pathname, role);
  const sembunyiText = collapsed ? "lg:hidden" : "";

  return (
    <nav className="scroll-shell min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {bagian.map((bagianSatu) => (
        <div key={bagianSatu.title} className="mb-5">
          <p
            className={`mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-shell-muted ${sembunyiText}`}
          >
            {bagianSatu.title}
          </p>
          <ul className="grid gap-1">
            {bagianSatu.items.map((item) => {
              const Ikon = IKON[item.icon];
              const sedangAktif = item.href === aktif;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={sedangAktif ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                      sedangAktif
                        ? "border-shell-primary/25 bg-shell-primary/15 text-shell-primary-strong"
                        : "border-transparent text-shell-ink-soft hover:bg-shell-soft hover:text-shell-ink"
                    } ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
                  >
                    <Ikon
                      className={`h-4 w-4 shrink-0 ${
                        sedangAktif
                          ? "text-shell-primary-strong"
                          : "opacity-80"
                      }`}
                    />
                    <span className={`truncate ${sembunyiText}`}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
