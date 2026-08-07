/**
 * 桌面开发启动器：并行运行 Vite dev server、Electron 主进程 tsc watch，
 * 等 4173 端口就绪后拉起 Electron 加载渲染进程。
 */
import { spawn } from "node:child_process";
import http from "node:http";

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
const tsc = spawn("npx", ["tsc", "-p", "electron/tsconfig.json", "--watch", "--preserveWatchOutput"], { stdio: "inherit" });
children.push(tsc);

try {
  await waitForServer(DEV_URL, 30000);
  const electron = spawn("npx", ["electron", "."], {
    stdio: "inherit",
    env: { ...process.env, TRPG_EDITOR_DEV: "1" },
  });
  children.push(electron);
  electron.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Electron 退出码 ${code}`);
      shutdown(code);
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
