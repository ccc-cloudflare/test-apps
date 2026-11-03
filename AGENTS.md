# AGENTS.md

給在本 repo 工作的自動化代理（Claude Code、Codex 等）的說明。

## Repo 結構

```
test-apps/
  <app名>/          每個 Cloudflare Worker 應用一個資料夾，自包含
  doc/              平台知識文件（方案、產品、限制、金流、發佈）
```

目前只有一個應用：`mini-lang-expert/`（LLM 對話 + 247 字檢查工具的 Worker）。

## 常用指令

```bash
cd mini-lang-expert
npm install                     # 只在新機器或依賴改動時
npm run dev                     # 本機測試（wrangler dev，需要 .dev.vars 有 NVIDIA_API_KEY）
npx wrangler deploy             # 部署到 Cloudflare（更新的唯一必要指令）
npx wrangler tail               # 看線上即時 log
npm run sync                    # 可選：從上游 mini-lm 專案同步前端與資料（會覆蓋 public/）
```

沒有測試框架、沒有 linter。驗證方式：

1. `node --check src/worker.js` 檢查語法
2. `npx wrangler dev` 起本機後 `curl` 煙霧測試：
   * `curl localhost:8787/api/status` → 應回 JSON（`key` 是否為 true）
   * `curl -X POST localhost:8787/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"你好"}]}'` → 應回 `data:` 開頭的 SSE 事件
3. 有 `NVIDIA_API_KEY` 時（`.dev.vars`）才測得到真實對話；沒有金鑰時 Worker 應回 `type: error` 事件而不是掛掉

## 慣例（改動前先讀）

* **應用自包含**：不要讓 `mini-lang-expert/` 引用 repo 外的檔案。上游 mini-lm 專案的資料已經 vendored 進 `public/` 與 `src/generated.js`，是原始檔，直接改。
* **秘密不進 repo**：金鑰用 `wrangler secret put`（線上）或 `.dev.vars`（本機），兩者都已 gitignore。檢查任何 diff 不含金鑰。
* **產生物不重造**：`public/`、`src/generated.js` 是原始檔。`sync.py` 只在同步上游時用，它會覆蓋本地修改——不要在沒問使用者的情況下執行。
* **文件放 `doc/`**：研究出的平台知識（限制、比較、金流、流程）寫成文件加進 `doc/README.md` 索引；文件間的相對連結要驗證有效。
* **語言**：所有文件與註解用繁體中文。
* **不主動 git commit / deploy**：`wrangler deploy` 會影響線上服務，先問使用者。

## 部署注意

* 部署是原子性的，但會立即影響線上：https://mini-lang-expert.ccckmit.workers.dev/
* 免費方案每次請求 CPU 限 10ms，長串流可能被砍（詳見 doc/cpu-limit.md）；改 Worker 時不要無謂增加每個 SSE chunk 的處理成本
* `/api/chat` 是公開的（有 CORS），改動時不要放寬認證/限制
