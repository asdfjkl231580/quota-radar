// 到账探针（2026-09-26 用户同意用本人 Codex 账号）：只读查自己账号用量，判断官方重置「实际几点到账」
// 原理：全员重置到账时，本账号用量会在周期未到时突然下降、或恢复时间跳变；重置卡到账时，可用重置卡数量变多
// 只在本机跑（登录信息不出这台 Mac），每 5 分钟一次；状态存 .probe/（不进仓库）
// 用法：node scripts/probe.mjs [--dry] [--no-deploy] [--no-feishu] [--no-git]；演练：PROBE_FAKE=假用量.json 代替真实查询
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, HOME, readJson, writeJson, sendFeishu, bj } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const STATE_DIR = path.join(ROOT, ".probe");
const STATE = path.join(STATE_DIR, "state.json");
const LOG = path.join(STATE_DIR, "probe.log");
fs.mkdirSync(STATE_DIR, { recursive: true });
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); fs.appendFileSync(LOG, line + "\n"); };
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
const notify = async (msg) => { if (args.has("--no-feishu") || args.has("--dry")) return log("（不发飞书）" + msg.replace(/\n/g, " ")); try { await sendFeishu(msg); } catch (e) { log("飞书失败 " + e.message.slice(0, 100)); } };

// ① 读登录（只读，不续期：续期会换掉登录凭据，可能把 Codex 桌面端登出）
const auth = JSON.parse(fs.readFileSync(path.join(HOME, ".codex/auth.json"), "utf8"));
const tk = auth.tokens || {};
const exp = JSON.parse(Buffer.from(tk.access_token.split(".")[1], "base64url").toString()).exp * 1000;
if (exp - Date.now() < 24 * 3600000 && state.expiryWarned !== exp) {
  state.expiryWarned = exp; save();
  await notify(`【额度雷达·探针】Codex 登录将在 ${bj(new Date(exp).toISOString())} 过期。打开一次 Codex（桌面端或终端 codex）它会自动续期，否则探针停摆。`);
}

// ② 查用量
let u;
try {
  if (process.env.PROBE_FAKE) { u = JSON.parse(fs.readFileSync(process.env.PROBE_FAKE, "utf8")); throw { fake: true }; }
  const r = await fetch("https://chatgpt.com/backend-api/wham/usage", { headers: { Authorization: "Bearer " + tk.access_token, "ChatGPT-Account-Id": tk.account_id, "User-Agent": "codex_cli_rs", originator: "codex_cli_rs" }, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) { if (!state.authFailAt) { state.authFailAt = new Date().toISOString(); save(); await notify("【额度雷达·探针】Codex 登录失效（" + r.status + "），探针停摆。终端运行 codex login 重新登录即可。"); } process.exit(1); }
  if (!r.ok) throw new Error("HTTP " + r.status);
  u = await r.json();
} catch (e) { if (!e.fake) { log("查询失败 " + e.message); process.exit(1); } }
delete state.authFailAt;

const now = Date.now();
const snap = (w) => w ? { used: w.used_percent, resetAt: w.reset_at * 1000, win: w.limit_window_seconds } : null;
const cur = { at: new Date(now).toISOString(), plan: u.plan_type, primary: snap(u.rate_limit?.primary_window), secondary: snap(u.rate_limit?.secondary_window), banked: u.rate_limit_reset_credits?.available_count ?? null };
const prev = state.last;
log(`用量 ${cur.primary?.used ?? "-"}%（恢复 ${cur.primary ? bj(new Date(cur.primary.resetAt).toISOString()) : "-"}）· 5 小时桶 ${cur.secondary ? cur.secondary.used + "%" : "无"} · 重置卡 ${cur.banked}`);

// ③ 判断：周期没到却清零 / 恢复时间提前跳到新周期 → 全员重置到账；重置卡变多 → 发卡到账
const signals = [];
if (prev) {
  for (const k of ["primary", "secondary"]) {
    const a = prev[k], b = cur[k];
    if (!a || !b) continue;
    const natural = now >= a.resetAt - 120000;                      // 到了自己的自然恢复点，不算
    const dropped = a.used - b.used >= 15;                          // 用量掉 15 个点以上
    const jumped = Math.abs(b.resetAt - a.resetAt) > 3600000;       // 恢复时间跳变 1 小时以上
    if (!natural && (dropped || jumped)) signals.push({ kind: "reset", bucket: k, detail: `${k === "primary" ? "周" : "5 小时"}额度 ${a.used}% → ${b.used}%，恢复时间 ${bj(new Date(a.resetAt).toISOString())} → ${bj(new Date(b.resetAt).toISOString())}` });
  }
  if (prev.banked != null && cur.banked != null && cur.banked > prev.banked) signals.push({ kind: "banked", detail: `可用重置卡 ${prev.banked} → ${cur.banked}` });
}
// 灵敏度：用量接近 0 且恢复时间不变时测不出重置，记下来给回测页看
state.sensitivity = (cur.primary?.used ?? 0) >= 15 ? "高（用量高，清零一眼可见）" : "低（用量接近 0，只能靠恢复时间跳变判断）";
state.last = cur; state.lastOkAt = cur.at; state.prevAt = prev?.at || null;
save();
if (!signals.length) process.exit(0);

// ④ 有信号：到账时间取「上次查询」和「这次查询」之间，记这次查询时间，并写明误差
const window = prev ? `${bj(prev.at)} ~ ${bj(cur.at)}` : bj(cur.at);
state.observations = [...(state.observations || []), ...signals.map((s) => ({ ...s, at: cur.at, window }))].slice(-50); save();
log("到账信号：" + signals.map((s) => s.detail).join("；"));
if (args.has("--dry")) process.exit(0);

if (!args.has("--no-git")) try { execFileSync("git", ["pull", "--rebase", "--autostash", "-q"], { cwd: ROOT }); } catch (e) { log("git pull 失败 " + e.message.slice(0, 120)); }
const ef = readJson("events.json", { events: [] });
const msgs = [];
for (const s of signals) {
  // 优先匹配 3 天内「已宣布、待生效」的 Codex 预告
  const pend = ef.events.find((e) => e.provider === "codex" && e.pendingReset && now - new Date(e.announcedAt) < 3 * 86400000 && (s.kind === "reset" || /bank/i.test(e.textEn)));
  // 哨兵可能已按官方确认先转正了：24 小时内转正、还没实测时间的同类记录，只补实测时间
  const done = !pend && ef.events.find((e) => e.provider === "codex" && !e.pendingReset && !e.observedAt && e.kind === (s.kind === "banked" ? "banked" : "reset") && now - new Date(e.promotedAt || e.announcedAt) < 86400000);
  if (done) {
    done.observedAt = cur.at; done.observedWindow = window; done.effectiveAt = cur.at;
    done.detail = `${(done.detail || "").trim()} 实测到账：${window}（北京时间）。`.trim();
    msgs.push(`· 官方已确认的 ${done.id} 补上实测到账时间：${s.detail}`);
  } else if (pend) {
    pend.pendingReset = false; pend.kind = s.kind === "banked" ? "banked" : "reset";
    pend.effectiveAt = cur.at; pend.observedAt = cur.at; pend.observedWindow = window; pend.promotedAt = cur.at;
    pend.detail = `${(pend.detail || "").trim()} 实测到账：${window}（北京时间，每 5 分钟探测一次）。`.trim();
    pend.zh = pend.zh.replace(/[，,（(]?\s*(尚未确认生效|生效时间未公布)\s*[）)]?/, "（已实测到账）").replace("将为", "为");
    msgs.push(`· 已把 ${pend.id} 从「已宣布」改成「已到账」：${s.detail}`);
  } else {
    // 找不到对应公告：官方可能没发帖或还没抓到。不凭空造记录，只通知人工
    msgs.push(`· 实测到账但没找到对应官方公告（${s.kind}）：${s.detail}。去 X 看 Tibo 是否发了帖，或是否只是个别账号。`);
  }
}
if (msgs.some((m) => m.includes("已到账") || m.includes("补上实测"))) {
  ef.updatedAt = new Date().toISOString(); writeJson("events.json", ef);
  if (!args.has("--no-git")) try {
    execFileSync("git", ["add", "data/events.json"], { cwd: ROOT });
    execFileSync("git", ["commit", "-q", "-m", "探针：实测 Codex 重置到账 " + window], { cwd: ROOT });
    execFileSync("git", ["push", "-q"], { cwd: ROOT });
  } catch (e) { log("提交失败 " + e.message.slice(0, 160)); }
  if (!args.has("--no-deploy")) try { execFileSync("node", ["scripts/deploy.mjs"], { cwd: ROOT, stdio: "inherit", timeout: 360000 }); log("已发布"); } catch (e) { log("发布失败 " + e.message.slice(0, 160)); }
}
await notify(`【额度雷达·探针】Codex 实测到账（${window}）\n${msgs.join("\n")}`);
