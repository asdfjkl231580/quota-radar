# 额度雷达 · 项目协作规范

## 项目信息
- 名称：额度雷达（Codex / Claude 送额度时间线）
- 目标：纯引流中文网页，转播官方在 X 上的送额度／重置／提额公告
- 技术栈：零依赖 Node（>=18）静态生成，Vercel 静态部署
- 关键路径：`data/events.json`（唯一真源）→ `scripts/build.mjs`（中文根路径 + `/en` 英文，文案字典 L、FAQ 两语言都在里面）→ `dist/`；样式 `site/styles.css`
- 时区：所有时间用 `<time data-ts data-mode>` 输出，前端按选的时区（localStorage `qr_tz`，中文默认北京、英文默认本地）用 Intl 重排；服务端兜底中文北京、英文 UTC
- 英文摘要：事件无 `en` 字段时自动取原帖前 150 字；要写好的英文一句话就在 events.json 加 `en`
- 一页纸：`docs/plans/2026-09-24-一页纸-额度雷达.md`
- 前期调研：`~/Documents/2026年9月23日－Codex重置网站研究项目工程/`

## 开发命令
- **哨兵（第二刀主链路）**：`node scripts/sentinel.mjs [--tikhub] [--dry] [--no-deploy] [--no-feishu]`：两参考站接口→（可选 TikHub）→fxtwitter 核原帖→能分类的自动上线并 build+vercel --prod→飞书。分类规则在文件头注释，77 条回测 73 对 3 待办 1 混合。自动上线的条目 confidence=auto，页面标「待整理」，随后 `review.mjs edit <id> --zh "..." --scope "..."` 补中文，edit 会自动把 auto 改成 high 并去掉「待整理」标，然后 `node scripts/build.mjs && vercel --prod`。
- **哨兵跑在 GitHub Actions（2026-09-26 起）**：仓库 https://github.com/asdfjkl231580/quota-radar（公开），工作流 `.github/workflows/sentinel.yml` 每 10 分钟一次、每小时 :03 带 TikHub；密钥在仓库 Secrets（TIKHUB/VERCEL/FEISHU 七个）。云端会把 data/*.json 的变化 commit 回 main，**本地改数据前必须先 `git pull`**，改完 `git push`。本机 launchd 已卸载，勿再装。GitHub CLI 官方版在 `~/.local/bin/ghcli`（账号 asdfjkl231580）。手动触发：`~/.local/bin/ghcli workflow run sentinel.yml --repo asdfjkl231580/quota-radar -f tikhub=true`
- 口径（2026-09-26 用户拍板）：将来时重置公告记 teaser（pendingReset），首页卡片三态——原帖有钟点→倒计时（expectedAt，到点按预告时间转正）；只说哪天→倒计时到那天（美西），那天过完无确认转正；没给时间→「官方已宣布，生效时间未公布」，**不自动转正**（9/26 宣布后 4 小时评论区仍没到账），等官方确认帖或回复（哨兵带 TikHub 时会查该账号回复，确认词命中即按回复时间转正），满 24 小时飞书提醒人工判断。时间由 lib.parseExpected 自动读，读错用 `review.mjs edit <id> --expect <ISO> [--precision day]` 改，`--pending` 改回预告。回测：`node scripts/qa.mjs`
- **到账探针（2026-09-26 用户同意用本人 Codex 账号）**：`node scripts/probe.mjs`，只读调 chatgpt.com/backend-api/wham/usage（凭据 ~/.codex/auth.json，**只在本机跑、不上云、不自己续期**，续期会换凭据把 Codex 桌面端登出；快过期飞书提醒用户开一次 Codex）。周期未到却用量掉 ≥15 点或恢复时间跳变 >1h → 全员重置到账；可用重置卡变多 → 发卡到账。匹配 3 天内 Codex 预告 → 转正并记 effectiveAt/observedAt（卡片标「实测到账」）；哨兵已先转正的只补实测时间；找不到公告只通知不造记录。状态在 `.probe/`（不进仓库）。定时任务文件 `ops/com.xiaoyuan.quota-radar.probe.plist`（5 分钟），**由用户自己装**。演练：`PROBE_FAKE=假用量.json node scripts/probe.mjs --no-git --no-deploy --no-feishu`
- 线索源还包括 codex-resets.com 公开 API（/api/v1/status 的 scheduled_reset 用来核对预告时间），展示须注明来源（关于页已写）
- 抓新线索：`node scripts/fetch.mjs`（TikHub 计费约 $0.01/账号；`--no-feishu` 不推飞书；`--dry` 不写盘）
- 人工确认：`node scripts/review.mjs list` / `approve <id> --kind reset --zh "..."` / `reject <id>`
- 构建：`node scripts/build.mjs`
- 本地预览：`node scripts/serve.mjs`（http://127.0.0.1:4537）
- 部署：`vercel --prod`（在本目录执行，勿在别处 `--yes`）

## 视觉真源（2026-09-24 晚拍板）
- 唯一视觉依据：`reference/full-reference.png`（GPT 出的交付规范板）+ 切出的 `desktop-reference.png` / `mobile-reference.png`；用户的文字规范在 `docs/design/UI交付规范V1.0.md`。高还原，不二次设计。
- Design tokens 在 build.mjs 的 :root：蓝 #1467F5、黄 #FFEA00、黑 #111111、辅助字 #727272、面板 #F7F8FA、边框 #E7E7E7。
- 英雄区标题/站名/贴纸用「演示斜黑体」子集 `site/assets/hero-font.woff2`（4.5KB），卡片名与天时分数字用「阿里妈妈数黑体」子集 `num-font.woff2`（2KB）；两款均免费商用。改字要重新子集：`python3 -m fontTools.subset ~/Library/Fonts/演示斜黑体.otf --text="..." --output-file=site/assets/hero-font.woff2 --flavor=woff2`）。
- 首页状态卡只放：名字、标签、「距上次送额度已过去」、天时分、「官方下次：尚未公布」、原帖。中文一句话不上首页，进 /timeline。
- 验收截图：`docs/design/screenshots/home-<w>x<h>.png`，五个尺寸 1440/1280/390/375/430。

## 架构约束
- 只收录官方账号原帖（`data/watch.json`），每条事件必须有 sourceUrl、scope、verifiedAt；未核实不进 events.json
- 事件分类四种：reset（全员重置）／banked（重置卡）／boost（提额）／teaser（预告，只人工收录，不进卡片计数，卡片下方显示一行）
- 原帖卡片数据在 `data/authors.json`，头像存 `site/assets/avatars/`（X 图片域名国内打不开）
- 页面上不出现「预测概率」；「下次重置时间」只在官方原帖明说时显示（倒计时），否则写「官方尚未公布」（2026-09-26 用户拍板）
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
