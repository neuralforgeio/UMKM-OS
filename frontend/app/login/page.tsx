import LoginClient from "./login-client";

// Halaman login (v1.3.0 — redesign glassmorphism + tema).
// Server component tipis: mengambil VERSI BACKEND asli dari Go saat
// request (bukan angka demo) lalu menyerahkan render ke komponen klien.
// instant = false (pola cacheComponents proyek ini): halaman dirender
// per-request supaya versi backend tidak dibekukan saat build.
export const instant = false;

const API_URL = process.env.API_URL ?? "http://localhost:8080";

async function fetchBackendVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/version`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { version?: string } };
    return json.data?.version ?? null;
  } catch {
    // Backend tidak terjangkau (mis. saat build) — badge versi disembunyikan.
    return null;
  }
}

export default async function LoginPage() {
  const backendVersion = await fetchBackendVersion();
  return <LoginClient backendVersion={backendVersion} />;
}
