# 定时抓取（未自动安装，按需装）

每天 08:20 / 20:20 各跑一次 `fetch.mjs --draft`（TikHub 4 个账号约 $0.04/次），有新线索会推飞书。

安装：
```sh
cp ops/com.xiaoyuan.quota-radar.fetch.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.xiaoyuan.quota-radar.fetch.plist
```
卸载：`launchctl unload ~/Library/LaunchAgents/com.xiaoyuan.quota-radar.fetch.plist`
