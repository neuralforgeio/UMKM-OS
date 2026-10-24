import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";

  // Halaman verifikasi struk (/verify/[code]) adalah satu-satunya
  // area publik aplikasi: pembeli membukanya dari QR / link di struk
  // TANPA akun. Kuncinya kode klaim, bukan sesi — jadi proxy tidak
  // boleh melempar pembeli ke /login (v1.3.0, backend-go
  // /api/v1/public/receipt/*). Semua rute lain tetap wajib login.
  const isPublicVerify = req.nextUrl.pathname.startsWith("/verify/");

  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  if (!isLoginPage && !isPublicVerify && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
