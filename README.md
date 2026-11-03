# test-apps

一系列 Cloudflare Workers 的測試應用。每個應用一個資料夾，**自包含**：clone 後 `npm install` + `npx wrangler deploy` 就能上線，不依賴其他專案。

| 應用 | 做什麼 |
|---|---|
| [mini-lang-expert/](mini-lang-expert/) | Mini-Lang 專家：LLM 對話（NVIDIA GLM 5.3 Flash）+ 247 字檢查工具循環，含靜態前端（專家聊天頁 + 規則翻譯器） |

## 文件

平台的知識（方案、產品線、限制、金流、發佈流程）集中在 [doc/](doc/)：

| 文件 | 內容 |
|---|---|
| [doc/README.md](doc/README.md) | 索引與快速結論 |
| [doc/plans.md](doc/plans.md) | 帳號方案：Free / Pro / Business / Enterprise 與 Workers Paid |
| [doc/products.md](doc/products.md) | 產品線：Workers、KV、R2、D1、Durable Objects、AI Gateway… |
| [doc/cpu-limit.md](doc/cpu-limit.md) | Workers 的 CPU 時間限制（免費方案 10ms）與優化 |
| [doc/workers-vs-linode.md](doc/workers-vs-linode.md) | Serverless vs 自架 VPS 的比較 |
| [doc/payments.md](doc/payments.md) | 金流：Stripe 台灣、Merchant of Record、本地金流 |
| [doc/release.md](doc/release.md) | 發佈流程與出錯回溯 |

## 開發慣例

* **每個應用自包含**：不 import 其他資料夾或外部專案的檔案；需要上游資料時，把產物直接 commit 進來（見 `mini-lang-expert/sync.py` 的做法）。
* **秘密一律用 Worker 密鑰**（`npx wrangler secret put`），本機測試用 `.dev.vars`——兩者都已 gitignore，金鑰絕不進 repo。
* **前端與資料是原始檔**：放在各應用的 `public/` 與 `src/`，直接改，改完 `npx wrangler deploy`。
* **平台的知識寫進 `doc/`**：研究過的問題（限制、比較、金流）留成文件，避免下次重查。
