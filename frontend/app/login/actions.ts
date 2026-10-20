"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

type LoginState = { error: string } | null;

// Next.js navigation (redirect) uses special errors whose digest starts
// with NEXT_REDIRECT. Those must bubble up, never be swallowed here.
function isNextRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || email.trim() === "") {
    return { error: "Email wajib diisi." };
  }
  if (typeof password !== "string" || password === "") {
    return { error: "Password wajib diisi." };
  }

  try {
    await signIn("credentials", {
      email: email.trim(),
      password,
      redirectTo: "/",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof AuthError) {
      return { error: "Email atau password salah." };
    }
    console.error("loginAction failed:", error);
    return { error: "Gagal masuk. Coba beberapa saat lagi." };
  }

  return null;
}
