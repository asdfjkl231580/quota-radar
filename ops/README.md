# 定时任务（文件给你，不自动装）

## 哨兵（第二刀，推荐装这个）
每 10 分钟跑一次 `sentinel.mjs`：查两个参考站接口（免费），每小时整点那次加 TikHub 直查两个主账号（约 $0.02/次）。发现新帖 → 核原帖 → 能分类的自动上线并发布 → 飞书通知。

```sh
cp ops/com.xiaoyuan.quota-radar.sentinel.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.xiaoyuan.quota-radar.sentinel.plist
```
停：`launchctl unload ~/Library/LaunchAgents/com.xiaoyuan.quota-radar.sentinel.plist`
日志：`data/sentinel.log`（脚本自己写）与 `data/sentinel-launchd.log`（启动输出）。

## 旧版每日抓取（可不装）
`com.xiaoyuan.quota-radar.fetch.plist`：每天 08:20 / 20:20 跑 `fetch.mjs`（4 个账号约 $0.04/次），只进待办不自动上线。装了哨兵就不需要它。
