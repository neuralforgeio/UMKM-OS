import type { UserMenuUser } from "@/components/user-menu";
import { UserAvatar } from "@/components/user-menu";
import { roleLabelOf } from "@/lib/avatar";

// Baris pengguna di dasar sidebar: avatar (foto atau inisial) + nama +
// label peran. Saat sidebar diringkatkan hanya avatar yang tampil pada
// layar lebar; laci ponsel selalu menampilkan nama lengkap.

export function SidebarUser({
  user,
  collapsed,
}: {
  user: UserMenuUser;
  collapsed: boolean;
}) {
  const sembunyiText = collapsed ? "lg:hidden" : "";
  return (
    <div
      className={`flex items-center gap-3 border-t border-shell-line px-4 py-4 ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      }`}
      title={collapsed ? user.name ?? "Pengguna" : undefined}
    >
      <UserAvatar user={user} className="h-9 w-9 text-xs" />
      <div className={`min-w-0 flex-1 ${sembunyiText}`}>
        <p className="truncate text-[11px] font-bold leading-tight text-shell-ink">
          {user.name?.trim() || "Pengguna"}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-tight text-shell-muted">
          {roleLabelOf(user.role)}
        </p>
      </div>
    </div>
  );
}
