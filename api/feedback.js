import { clientKey, feishu, rateLimit } from "./_kv.js";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "POST");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); } }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ ok: false, error: "invalid_body" });
  const { message = "", contact = "", page = "", lang = "zh", honey = "" } = body;
  if (honey) return res.status(200).json({ ok: true });
  if (typeof message !== "string" || message.trim().length < 2 || message.length > 2000) return res.status(400).json({ ok: false, error: "message_length" });
  if (typeof contact !== "string" || contact.length > 200) return res.status(400).json({ ok: false, error: "contact_length" });
  try {
    if (!await rateLimit("feedback", clientKey(req), 5, 600)) {
      res.setHeader("Retry-After", "600");
      return res.status(429).json({ ok: false, error: "too_many" });
    }
    let pathname = "/";
    try { pathname = new URL(String(page), "https://airesetclock.com").pathname.slice(0, 200); } catch { /* omit invalid URL */ }
    const text = `【额度雷达 留言】\n${message.trim()}\n\n联系：${contact.trim() || "未留"}\n页面：${pathname}\n语言：${lang === "en" ? "en" : "zh"}`;
    await feishu(text);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false, error: "feedback_unavailable" });
  }
}
