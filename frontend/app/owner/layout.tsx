import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MaintenanceBanner } from "@/components/maintenance-banner";

export const instant = false;

// Layout area owner (Task 35): satu tempat untuk dua kebijakan yang
// sebelumnya tersebar di setiap halaman:
//   1. KASIR tidak punya urusan di sini -> dilempar ke kasirnya.
//   2. DEVELOPER hanya boleh masuk KETIKA sedang mode maintenance
//      (session.user.outletId terisi lewat cookie dev_outlet). Tanpa
//      mode aktif dia dilempar balik ke /dev — halaman owner memang
//      butuh konteks outlet untuk menampilkan apa pun.
// Banner maintenance ikut terpasang sekali untuk semua halaman owner.
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "KASIR") redirect("/cashier");
    if (session.user.role === "DEVELOPER" && !session.user.outletId) {
      redirect("/dev");
    }
  }

  return (
    <>
      <MaintenanceBanner />
      {children}
    </>
  );
}
