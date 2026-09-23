import { defineConfig } from "vitest/config";
import path from "node:path";

// Deliberately separate from vite.config.ts (which is owned by the
// TanStack Start / Nitro build plugin) - unit tests exercise plain
// calculation modules and don't need the app's build pipeline at all.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
