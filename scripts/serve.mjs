// 本地预览 dist/，零依赖
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { ROOT } from "./lib.mjs";
const DIST = path.join(ROOT, "dist"); const PORT = Number(process.env.PORT || 4537);
const types = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", json: "application/json", xml: "application/xml", txt: "text/plain", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", ico: "image/x-icon" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(DIST, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": types[path.extname(f).slice(1)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`预览: http://127.0.0.1:${PORT}`));
