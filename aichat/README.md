# AI Chat（BYOK）

* 線上使用 -- https://aichat.ccckmit.workers.dev

自帶金鑰的聊天室：使用者在網頁上填入自己的 LLM API 金鑰（OpenAI 相容端點），金鑰只存在瀏覽器的 localStorage；對話經 Cloudflare Worker 轉發給供應商，Worker **不儲存、不記錄任何金鑰**，所以這個 Worker 沒有任何 secret，任何人都能部署自己的版本。

* 為什麼要經 Worker：瀏覽器直接打 LLM API 會被 CORS 擋住；Worker 代理同時解決 CORS 與隱藏瀏覽器指紋，但金鑰只是路過、不落地。
* 支援的端點有白名單（`src/worker.js` 的 `DEFAULT_HOSTS`），避免變成公開代理被濫用；想改用 `wrangler.jsonc` 的 `vars.ALLOWED_HOSTS` 覆蓋。

## 部署

```bash
cd aichat
npm install
npx wrangler deploy      # 沒有任何 secret，不用 login 以外的設定
```

本機測試：`npm run dev`。

## 檔案

| 檔案 | 說明 |
|---|---|
| `src/worker.js` | 代理：驗證白名單 → 轉發請求 → 回應原樣穿透（不解析內容，CPU 幾乎為零，免費方案可跑） |
| `public/` | 前端：設定面板（端點/模型/金鑰）、串流對話、Markdown 渲染、思考過程摺疊 |

## 供應商

| 供應商 | API 端點（OpenAI 相容） | 金鑰 |
|---|---|---|
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `nvapi-…`（build.nvidia.com 免費額度） |
| OpenAI | `https://api.openai.com/v1` | `sk-…` |
| DeepSeek | `https://api.deepseek.com/v1` | `sk-…` |
| OpenRouter | `https://openrouter.ai/api/v1` | `sk-or-…` |

相關文件見 `../doc/`（Workers 免費方案的 CPU 限制、發佈流程）。
