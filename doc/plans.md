# Cloudflare 帳號方案

> Cloudflare 的方案分成「帳號方案」（整個帳號的基礎功能）和「產品用量」（Workers、R2 等按量計費）。這篇整理帳號方案的差別，以及跑我們這類應用需要哪一檔。

## 1. 帳號方案一覽

| 方案 | 月費 | 定位 |
|---|---|---|
| **Free** | $0 | 個人專案、實驗：CDN、DNS、SSL、無限頻寬、基本的 Workers 額度 |
| **Pro** | $20/月 | 認真經營一個網站：WAF 規則、圖片優化、進階分析 |
| **Business** | $200/月 | 小企業：進階 WAF、100% uptime SLA、自訂憑證 |
| **Enterprise** | 客製（通常年薪數萬美元起） | 大企業：SLA、帳號團隊、Bot 管理 |

重點：**網站的 CDN/DNS/SSL 在 Free 就有無限頻寬**，Pro 以上買的是安全和企業功能。跑 Workers 應用**不需要** Pro——Workers 是獨立計費的產品。

## 2. Workers 專屬方案

Workers 不吃上面的帳號方案，而是自己的 Free / Paid：

| | Workers Free | Workers Paid（$5/月起） |
|---|---|---|
| 請求數 | 100,000／天 | 1,000 萬／月起，之後 $0.30/百萬 |
| CPU 時間 | **10ms／請求，不能調** | 30 秒／請求（可調到 5 分鐘） |
| 靜態資產請求 | 免費、不算額度 | 同左 |
| Worker 大小（打包後） | 3 MB | 10 MB |
| KV | 100,000 讀／天 | 含用量，之後按量 |
| D1 | 500 萬列讀取／天 | 含用量 |
| R2 | 10 GB 儲存，A 類操作 100 萬次／月 | 10 GB 含在內，之後 $0.015/GB/月 |
| Durable Objects | 不可用 | 可用 |
| Cron Triggers | ✓（5 個） | ✓ |

見 [cpu-limit.md](cpu-limit.md) 對 10ms 限制的完整分析。

## 3. 怎麼選

| 情況 | 建議 |
|---|---|
| 個人實驗、低流量、回答短 | **Free 就夠**；先做 [cpu-limit.md](cpu-limit.md) 第 5 節的優化 |
| LLM 串流代理（像 mini-lang-expert） | **Workers Paid $5/月**：10ms 對長串流太緊，30 秒 CPU 遠遠夠用 |
| 產品網站需要 WAF/圖片優化 | Pro $20/月，但那是「網站」功能，跟 Workers 無關 |
| 需要 Durable Objects（即時協作、狀態） | 一定要 Workers Paid |

## 4. 付款方式

* **需要國際信用卡**（Visa/Mastercard），台灣發行的可用。
* 不支援 PayPal、超商、ATM 轉帳——**沒有國際信用卡就開不了 Paid**，這是台灣使用者最常見的門檻。
* 發票是美元計價，帳單在 dashboard 的 Billing。

## 5. 免費額度的共同陷阱

1. **公開 API 會被燒額度**：任何知道 workers.dev 網址的人都能用你的額度（像我們的 `/api/chat`）。要加 rate limiting 或限制 CORS 來源。
2. **每天歸零**：Free 的 100,000 請求/天用完當天就 429，不像很多平台是月結。
3. **子請求也算**：一次 Worker 執行最多 50 個 fetch（Free）；LLM 工具循環每一輪都是一個子請求，最多 5 輪沒問題，但要留意。
4. **升級是帳號級的**：Workers Paid 啟用後，帳號下所有 Worker 共享用量額度，不是每個 Worker 各一份。

## 6. 和自架 VPS 的取捨

費用比較、維運成本與選擇建議，見 [workers-vs-linode.md](workers-vs-linode.md)。
