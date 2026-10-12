/**
 * 桌面开发启动器：并行运行 Vite dev server、Electron 主进程 tsc watch，
 * 等 4173 端口就绪后拉起 Electron 加载渲染进程。
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";

const DEV_URL = "http://127.0.0.1:4173/";
const children = [];

function waitForServer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`等待 ${url} 就绪超时（${timeoutMs}ms）`));
          return;
        }
        setTimeout(attempt, 300);
      });
      request.setTimeout(2000, () => request.destroy());
    };
    attempt();
  });
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const vite = spawn("npx", ["vite"], { stdio: "inherit" });
children.push(vite);
mkdirSync("dist-electron", { recursive: true });
writeFileSync(
  "dist-electron/package.json",
  JSON.stringify({ type: "commonjs" }),
);
let ready;
const initialCompile = new Promise((resolve) => {
  ready = resolve;
});
let output = "";
let bundleQueue = Promise.resolve();
const tsc = spawn(
  "npx",
  [
    "tsc",
    "-p",
    "electron/tsconfig.json",
    "--watch",
    "--pretty",
    "false",
    "--preserveWatchOutput",
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);
children.push(tsc);
tsc.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  output = (output + String(chunk)).slice(-2000);
  if (!output.includes("Found 0 errors. Watching for file changes.")) return;
  output = "";
  bundleQueue = bundleQueue
    .then(
      () =>
        new Promise((resolve, reject) => {
          const bundler = spawn(
            process.execPath,
            ["scripts/bundle-preload.mjs"],
            { stdio: "inherit" },
          );
          children.push(bundler);
          bundler.on("error", reject);
          bundler.on("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`preload 打包失败：${code}`)),
          );
        }),
    )
    .then(() => ready())
    .catch((error) => {
      console.error(error);
      shutdown(1);
    });
});

try {
  await Promise.all([waitForServer(DEV_URL, 30000), initialCompile]);
  const electronEnv = { ...process.env, TRPG_EDITOR_DEV: "1" };
  delete electronEnv.ELECTRON_RUN_AS_NODE;
  const electron = spawn("npx", ["electron", "."], {
    stdio: "inherit",
    env: electronEnv,
  });
  children.push(electron);
  electron.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Electron 退出码 ${code}`);
      shutdown(code);
    } else shutdown(0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
