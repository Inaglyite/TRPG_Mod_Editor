import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

const packageVersion = (
  JSON.parse(
    readFileSync(new URL("./package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __EDITOR_VERSION__: JSON.stringify(
      process.env.TRPG_EDITOR_VERSION || packageVersion,
    ),
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    exclude: ["node_modules/**", "dist/**", "dist-electron/**", "e2e/**"],
    environment: "node",
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
