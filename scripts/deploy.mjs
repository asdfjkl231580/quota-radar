/**
 * deploy.mjs — build → vercel --prod → IndexNow 推送（Bing/Yandex/Naver 等即时收录）
 * 用法：node scripts/deploy.mjs [--no-indexnow]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, readJson } from "./lib.mjs";
const site = readJson("site.json");
execFileSync("node", ["scripts/build.mjs"], { cwd: ROOT, stdio: "inherit" });
const vercel = ["/Users/kenyuanlin/.npm-global/bin/vercel", "/opt/homebrew/bin/vercel", "/usr/local/bin/vercel"].find((p) => fs.existsSync(p)) || "vercel";
const outp = execFileSync(vercel, ["--prod", "--yes"], { cwd: ROOT, encoding: "utf8", timeout: 300000, env: { ...process.env, PATH: (process.env.PATH || "") + ":/opt/homebrew/bin:/usr/local/bin" } });
console.log(/READY/.test(outp) ? "已发布生产" : outp.slice(-300));
if (!process.argv.includes("--no-indexnow")) {
  try {
    const { key } = readJson("indexnow.json");
    const sm = fs.readFileSync(path.join(ROOT, "dist/sitemap.xml"), "utf8");
    const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const host = new URL(site.url).host;
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ host, key, keyLocation: `${site.url}/${key}.txt`, urlList: urls }) });
    console.log(`IndexNow ${r.status}：推送 ${urls.length} 个地址`);
  } catch (e) { console.log("IndexNow 失败: " + e.message); }
}
