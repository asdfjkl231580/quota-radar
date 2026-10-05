# 额度雷达 · 项目协作规范

## 项目信息
- 名称：额度雷达（Codex / Claude 送额度时间线）
- 目标（用户2026-10-05最新决定，替代旧路线）：纯公域获客，先通过搜索带来真实访问，再探索广告、明确标识的合作链接与网页自助收入。不以微信群、训练营、咨询或人工销售为收入前提。公开信息免费，广告、联盟与支付尚未接入，不能宣称已有收益。
- 技术栈：零依赖 Node（>=18）静态生成，Vercel 静态部署
- 关键路径：`data/events.json`（唯一真源）→ `scripts/build.mjs`（中文根路径 + `/en` 英文，文案字典 L、FAQ 两语言都在里面）→ `dist/`；样式 `site/styles.css`
- 时区：所有时间用 `<time data-ts data-mode>` 输出，前端按选的时区（localStorage `qr_tz`，中文默认北京、英文默认本地）用 Intl 重排；服务端兜底中文北京、英文 UTC
- 英文摘要：事件无 `en` 字段时自动取原帖前 150 字；要写好的英文一句话就在 events.json 加 `en`
- 一页纸：`docs/plans/2026-09-24-一页纸-额度雷达.md`
- 前期调研：`~/Documents/2026年9月23日－Codex重置网站研究项目工程/`

## 当前交付状态（2026-10-05）
- 自然搜索第一阶段：每条事件生成中英详情 `/events/<id>` 与 `/en/events/<id>`；只有 `verified=true && confidence=high` 进入网站地图/RSS，其余详情 `noindex,follow`。当前80条原记录未改，79条符合搜索推荐条件，地图194个URL（原34个）。这不代表搜索引擎已收录194页。
- 问答由 `scripts/guides.mjs` 补实用正文和官方参考，9个双语主题；规则核验日期固定，不随构建伪造更新。不要恢复统一“五小时”或“所有重置都恢复两个桶”的旧说法。
- 每条详情、FAQ、产品记录互链，RSS指向本站详情并保留原帖和旧GUID；网站地图不再用部署日期充当内容修改日。73项回归通过。
- Google后台已可访问，初始成效为3次展示/0点击（图表数据到10月3日）；后续必须从后台读真实结果，不能把提交请求说成收录、排名或流量增长。
- 用户确认低成本日更：每日09:30北京检查一次；状态页明确非实时。
- 65项离线回归与构建通过；误报2106610099720720811已纠正归档，公开80条事件；该次历史版本34页。
- GitHub VERCEL_TOKEN已换成用户创建的quota-radar项目范围Token，有效期至2027-01-03。只存GitHub Secret，勿回显或复制到文档。
- 真实云端运行37313458418于21:00北京时间完成Vercel发布及正式域名JSON全文/首页版本回读，release.lastError已清空。替换凭据和实际部署均有证据，勿继续沿用此前“凭据待更换”的旧结论。
- 21:06正式/api/health返回HTTP200、ok=true、reasons=[]，采集与发布正常，目标/已部署/正式版本一致。恢复后GitHub公开账本曾短暂读到旧缓存，已消退；验收存于Documents/2026年10月5日－额度雷达发布恢复项目工程/自动发布恢复验收.json。
- 收费、真实反馈投递、生产计数Lua写入与国内微信实机验收，未由本轮密钥恢复覆盖。

## 开发命令与维护口径
- **哨兵主链路**：`node scripts/sentinel.mjs [--tikhub] [--dry] [--no-deploy] [--no-feishu]`。参考站提供线索，可选 TikHub 直查，fxtwitter 核验官方原帖；可明确分类的记录入库，不确定内容进待办。分类与时间、关联证据逻辑在 `scripts/pipeline.mjs`。自动入库条目 `confidence=auto`，页面标「待整理」；`review.mjs edit <id> --zh "..." --scope "..."` 补中文后提升为人工核实，再用 `npm run deploy` 发布。
- **每日采集（用户2026-10-05明确要求）**：Vercel 的 /api/cron 在北京时间每天09:30（UTC 01:30）触发GitHub sentinel.yml，携带tikhub=true。一次检查免费线索、Tibo和ClaudeDevs；有关联待确认事件时沿用原有回复回查。GitHub原每两小时兜底与独立每日schedule均已移除，避免重复采集；workflow_dispatch保留，手动默认tikhub=false。勿恢复十分钟轮询、增加付费频率或另装本机launchd。GitHub将data/*.json状态写回main，本地改数据前先同步最新main；凭据存现有Secrets，不回显。
- **预告与生效**：保留 2026-09-26 用户确定的三态。将来时重置记 `teaser + pendingReset`；官方给出无歧义钟点，才显示倒计时并到点按预告时间计；只给哪天，等美西当天结束再按预告口径计；无明确时间则不自动转正，满 24 小时提醒人工判断。原帖中的否定、历史领取提醒、与重置无关的模型发布时间不能当成新重置。
- **严格关联确认**：确认内容须来自同一官方账号，时间不早于预告，并通过回复父帖、会话、引用帖 ID 或原帖链接明确关联该事件；还要命中实际完成语义并排除否定或疑问。不能仅凭同账号出现“is live / rolled out”就确认。带 TikHub 的轮次查回复，仍须核验原帖作者、正文及关联关系。
- **时间与证据优先级**：人工纠正 > 官方确认 > codex-resets 执行观测 > 官方预告时间。更高优先级证据可更正已按较弱证据转正的时间，保留更正记录。无时区钟点、PST/PDT 与当日美西时区冲突、夏令时重复/不存在钟点及含糊日期，写入 `expectedAmbiguity`，不编造倒计时或自动转正。第三方排期只作参考，不能替代官方时间；不使用本人账号额度探针。
- 人工维护：`node scripts/review.mjs list` / `approve <id> --kind reset --zh "..."` / `reject <id>`。预告时间用 `edit <id> --expect <ISO> [--precision day]`；改回预告用 `--pending`；人工确认完成用 `--kind reset --at <ISO>`，同时清理旧的预告状态，勿只手改 kind。
- 线索源还包括 codex-resets.com 公开 API（`/api/v1/status` 的 `scheduled_reset` 用来核对预告时间），展示须注明来源（关于页已写）。
- **发布状态**：`data/release.json` 的 `targetVersion` 是待发布事件快照，`deployedVersion/deployedAt` 只在生产读回成功后更新，`lastAttemptAt/lastError` 记录尝试与失败。版本由 `scripts/snapshot.mjs` 对原始事件计算；公开 API 事件是展示投影，不能直接用它重算原始版本。发布失败保留目标版本并返回失败；目标版本不同或lastError仍存在时，下轮即使没有新公告也会重试；不能只等待新事件触发发布。
- **采集状态**：`data/health.json` 记录 `schemaVersion`、`lastAttemptAt`、`lastSuccessAt`、`status` 和各来源 `sources` 的状态、成功时间及错误。正常但没有新事件时，采集心跳仍前进；心跳本身不改变事件版本，也不触发整站发布。全部主要线索源失败或全部新线索核验失败，不能报成功。
- **看门狗与公开状态**：`api/cron.js` 缺少 `CRON_SECRET` 时禁止触发；同时检查采集心跳、目标/已部署/生产版本及工作流状态，不再只看 workflow success。每日采集超过 26 小时（含2小时宽限）无成功、发布版本不匹配或触发失败需告警。`GET /api/health` 是脱敏只读入口，不发消息、不触发工作流；`/status` 展示采集和发布状态。`events.updatedAt` 是数据变更时间，陈旧不等于采集失败。
- **飞书回执**：云端 API 必须通过 HTTP、业务 code 和 `message_id` 校验；本地 Hermes 还须 `success=true` 且未 skipped。调用 `sendFeishu` 必须 `await`。看门狗取得回执后才写一小时去重标记，失败不得声称已送达；下划线 API helper 位于 `api/_kv.js`。
- **求重置与反馈**：`api/beg.js` + `site/beg.js` 仍按最近一次送额度分轮，24 小时内为「谢谢重置」，数字是点击次数而非人数。计数存原有 Upstash，POST 必须带 provider、事件 id、mode、n 与 batchId；客户端串行发送，每批 ≤10，重试复用同一 batchId，服务端原子去重 24 小时；旧轮次拒绝计入新轮。每 IP 每分钟 ≤120；反馈采用共享 KV 原子限流（每 IP 每 10 分钟 5 条）。KV/消息失败返回不可用，不显示假零或假成功。
- **统计（历史配置记录）**：Vercel Web Analytics 已开，脚本 `/_vercel/insights/script.js` 已埋；此前 Google 首页收录、sitemap 提交成功，百度 www 已验证。索引及流量结果需另行检查，不由本轮离线测试证明。
- 抓新线索：`node scripts/fetch.mjs`（TikHub 计费约 $0.01/账号；`--no-feishu` 不推飞书；`--dry` 不写盘；付费与外发沿用既有授权边界）。
- 本地检查：`npm test`（离线回归）、`npm run validate`（事件数据校验）、`npm run build`（构建）。`npm run qa` 检查生产公开页面、事件与只读健康入口，失败返回非零；它不触发 `/api/cron`。
- 本地预览：`npm run serve`（http://127.0.0.1:4537）。
- **部署唯一维护入口：`npm run deploy`**，在本目录执行。它先校验数据、构建，再部署并读回生产 JSON 与首页版本，失败不会记录已部署。**不要直接运行 `vercel --prod` 或 build + vercel 绕过发布记录和生产验收**；命令内部调用 Vercel 不改变既有公开发布授权要求。

## 视觉真源（2026-09-24 晚拍板）
- 唯一视觉依据：`reference/full-reference.png`（GPT 出的交付规范板）+ 切出的 `desktop-reference.png` / `mobile-reference.png`；用户的文字规范在 `docs/design/UI交付规范V1.0.md`。高还原，不二次设计。
- Design tokens 在 build.mjs 的 :root：蓝 #1467F5、黄 #FFEA00、黑 #111111、辅助字 #727272、面板 #F7F8FA、边框 #E7E7E7。
- 英雄区标题/站名/贴纸用「演示斜黑体」子集 `site/assets/hero-font.woff2`（4.5KB），卡片名与天时分数字用「阿里妈妈数黑体」子集 `num-font.woff2`（2KB）；两款均免费商用。改字要重新子集：`python3 -m fontTools.subset ~/Library/Fonts/演示斜黑体.otf --text="..." --output-file=site/assets/hero-font.woff2 --flavor=woff2`）。
- 首页状态卡只放：名字、标签、「距上次送额度已过去」、天时分、「官方下次：尚未公布」、原帖。中文一句话不上首页，进 /timeline。
- 验收截图：`docs/design/screenshots/home-<w>x<h>.png`，五个尺寸 1440/1280/390/375/430。

## 架构约束
- 只收录官方账号原帖（`data/watch.json`），每条事件必须有 sourceUrl、scope、verifiedAt；未核实不进 events.json
- 事件分类四种：reset（全员重置）／banked（重置卡）／boost（提额）／teaser（预告，明确的官方原帖可自动入库；不进已生效计数，按预告状态展示）
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


## 2026-10-03 正式发布回读（历史；凭据问题已于10月5日恢复）
- 修复代码已合入 main；部署于 05:54 UTC 完成，airesetclock.com 的公开事件全文与首页版本回读通过。事件80条、页面34个。
- 本地62项回归通过；GitHub 离线回归与构建 run 37101273405 成功。
- 使用现有本机 Vercel 登录完成本次发布。GitHub Secrets 的 VERCEL_TOKEN 仍失效：CLI OAuth 无权签发长期token（403 Cannot create tokens for this app），需要账户持有人通过正规凭据页面轮换并更新同名Secret，再验收一次真实云端部署。不要把本机短期OAuth token复制到CI，不要因当前页面更新或健康接口正常而宣布自动部署已恢复。
- 收费系统尚未实施；公开基础信息免费，下一步个性化提醒及工作流按试点验收推进。
