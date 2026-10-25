import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Test frontend UMKM OS — fungsi murni (tanpa DOM, tanpa server Next
// nyala), jadi environment "node" cukup dan berjalan cepat di CI.
// Komponen berinteraksi penuh dengan server action/backend-go dan
// diuji lewat smoke test manual + curl, bukan di sini.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
