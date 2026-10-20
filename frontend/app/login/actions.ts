"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

type LoginState = { error: string } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", formData);
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or Password Invalid" };
    }
    throw error;
  }
}
