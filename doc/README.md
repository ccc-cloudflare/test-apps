# Cloudflare 測試應用：文件索引

> 這個資料夾放一系列 Cloudflare apps（`test-apps/<app名>/`），`doc/` 記錄各應用會用到的平台知識：帳號方案、產品線、限制與金流。

## 應用

| 應用 | 做什麼 | 文件 |
|---|---|---|
| [mini-lang-expert/](../mini-lang-expert/) | Mini-Lang 專家：LLM 對話（NVIDIA GLM）+ 247 字檢查工具的 Worker，含靜態前端。**自包含**，clone 後 `npx wrangler deploy` 即可上線 | [cpu-limit.md](cpu-limit.md)、[workers-vs-linode.md](workers-vs-linode.md)、[payments.md](payments.md) |

## Cloudflare 文件

| 文件 | 內容 |
|---|---|
| [plans.md](plans.md) | 帳號方案：Free / Pro / Business / Enterprise 與 Workers Paid，各方案的差別、怎麼選、付款方式 |
| [release.md](release.md) | 發佈流程：第一次部署、之後的更新（就一步 `wrangler deploy`）、在其他機器重建、出錯回溯 |
| [products.md](products.md) | 產品線：Workers、Static Assets、KV、R2、D1、Durable Objects、Queues、Cron、Workers AI、AI Gateway、Vectorize 等，各是什麼、什麼時候用 |
| [cpu-limit.md](cpu-limit.md) | Workers 的 CPU 時間限制：免費方案 10ms 意味著什麼、對串流 LLM 應用的影響、免費檔的優化做法 |
| [workers-vs-linode.md](workers-vs-linode.md) | Serverless 和自己開 VPS 的比較：費用、維運、限制，這個專案怎麼選 |
| [payments.md](payments.md) | 金流：付錢給平台的方式、向使用者收費的選項（Stripe 台灣、Merchant of Record、台灣本地金流）與導入路徑 |

## 快速結論

| 問題 | 結論 |
|---|---|
| 免費方案能不能跑 LLM 代理？ | 短對話可以；長回答的串流可能超過 10ms CPU 而中斷 → Workers Paid（$5/月）或做 [cpu-limit.md](cpu-limit.md) 的批次轉發優化 |
| 要不要自己開 VPS？ | 除非要「同一台機器跑別的東西」或想維持單一 Python 實作，否則 Workers 維運成本最低（[workers-vs-linode.md](workers-vs-linode.md)） |
| 怎麼收費？ | 先 BYOK（使用者自帶金鑰、不收錢）→ 要收費用 Lemon Squeezy / Paddle（個人名義）→ 量大後設行號改 Stripe 台灣版（[payments.md](payments.md)） |
| 放資料/狀態用什麼？ | 小量鍵值 → KV；結構化資料 → D1；大檔案 → R2；需要強一致狀態 → Durable Objects（[products.md](products.md)） |
| 怎麼發佈/更新？ | 應用是自包含的：clone 後 `npx wrangler deploy` 即可；更新就一步 `npx wrangler deploy`（[release.md](release.md)） |
