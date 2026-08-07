/**
 * 生产构建后向 dist/index.html 注入 CSP。
 * 开发模式不注入（Vite HMR 需要内联脚本）；桌面版加载 file:// 时由 CSP 兜底，
 * 阻止渲染进程加载远程脚本。connect-src 允许本地 TRPG Master 与任意 https 后端。
 */
import { readFileSync, writeFileSync } from "node:fs";

const INDEX_PATH = "dist/index.html";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* https:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

let html = readFileSync(INDEX_PATH, "utf8");
if (html.includes("Content-Security-Policy")) {
  console.log("CSP already present in dist/index.html");
  process.exit(0);
}
if (!html.includes("<head>")) {
  console.error("dist/index.html 缺少 <head>，无法注入 CSP");
  process.exit(1);
}
html = html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`);
writeFileSync(INDEX_PATH, html);
console.log("CSP injected into dist/index.html");
