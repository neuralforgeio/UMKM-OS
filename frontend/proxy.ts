import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isLoginPage = req.nextUrl.pathname === "/login"

    if (isLoginPage && isLoggedIn) {
        return NextResponse.redirect(new URL("/", req.nextUrl))
    }

    if (!isLoginPage && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", req.nextUrl))
    }

    return NextResponse.next()
})

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
