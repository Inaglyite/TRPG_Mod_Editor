import { build } from "rolldown";

// sandbox preload 只能 require 白名单内置模块；将 IPC 常量内联进单文件。
await build({
  input: "electron/preload.ts",
  platform: "node",
  external: ["electron"],
  output: { file: "dist-electron/preload.js", format: "cjs" },
});
