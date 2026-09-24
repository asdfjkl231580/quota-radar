# 额度雷达 · 项目协作规范

## 项目信息
- 名称：额度雷达（Codex / Claude 送额度时间线）
- 目标：纯引流中文网页，转播官方在 X 上的送额度／重置／提额公告
- 技术栈：零依赖 Node（>=18）静态生成，Vercel 静态部署
- 关键路径：`data/events.json`（唯一真源）→ `scripts/build.mjs` → `dist/`
- 一页纸：`docs/plans/2026-09-24-一页纸-额度雷达.md`
- 前期调研：`~/Documents/2026年9月23日－Codex重置网站研究项目工程/`

## 开发命令
- 抓新线索：`node scripts/fetch.mjs`（TikHub 计费约 $0.01/账号；`--no-feishu` 不推飞书；`--dry` 不写盘）
- 人工确认：`node scripts/review.mjs list` / `approve <id> --kind reset --zh "..."` / `reject <id>`
- 构建：`node scripts/build.mjs`
- 本地预览：`node scripts/serve.mjs`（http://127.0.0.1:4537）
- 部署：`vercel --prod`（在本目录执行，勿在别处 `--yes`）

## 视觉真源（2026-09-24 晚拍板）
- 唯一视觉依据：`reference/full-reference.png`（GPT 出的交付规范板）+ 切出的 `desktop-reference.png` / `mobile-reference.png`；用户的文字规范在 `docs/design/UI交付规范V1.0.md`。高还原，不二次设计。
- Design tokens 在 build.mjs 的 :root：蓝 #1467F5、黄 #FFEA00、黑 #111111、辅助字 #727272、面板 #F7F8FA、边框 #E7E7E7。
- 英雄区标题/站名/贴纸用站酷高端黑子集 `site/assets/hero-font.woff2`（约 5KB，只含那十几个字；改字要重新子集：`python3 -m fontTools.subset ~/Library/Fonts/站酷高端黑修订151105.ttf --text="..." --output-file=site/assets/hero-font.woff2 --flavor=woff2`）。
- 首页状态卡只放：名字、标签、「距上次送额度已过去」、天时分、「官方下次：尚未公布」、原帖。中文一句话不上首页，进 /timeline。
- 验收截图：`docs/design/screenshots/home-<w>x<h>.png`，五个尺寸 1440/1280/390/375/430。

## 架构约束
- 只收录官方账号原帖（`data/watch.json`），每条事件必须有 sourceUrl、scope、verifiedAt；未核实不进 events.json
- 事件分类只有三种：reset（全员重置）／banked（重置卡）／boost（提额省额）
- 页面上不出现「预测概率」「下次重置时间」，只写「官方尚未公布」
- TikHub 密钥在钥匙串 `TikHub-API`；ADMIN_TOKEN 读主仓 `.env.local`
- 中文一句话在 approve 时人工写。`--draft` 走自建智能体 /api/chat 实测 25 秒起步且带命理 RAG 引用，不适合，默认不用

## 文档与记忆
- 进度快照：`docs/progress.md`
- 每日记忆：`docs/memory/YYYY-MM-DD.md`
- 复盘记录：`docs/postmortem/`

## 已解决问题（持续补充）
- 飞书通知必须用 Hermes profile `ops-watch-agent`（default 机器人不在群里，报 230002）。
- 无头 Chrome `--window-size=390` 实际视口 500，验手机端要用 puppeteer setViewport。
- 两个同类站「距上次重置」差 10 天：口径不同（一家把重置卡算进去）。本站分类展示，不合并。
- didreset 的 summary 有时是站方改写不是原文，种子数据一律以 fxtwitter 返回的原帖为准。
