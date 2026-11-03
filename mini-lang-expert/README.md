# Mini-Lang 專家（Cloudflare Worker 版）

* Cloudflare 線上展示版
  * https://mini-lang-expert.ccckmit.workers.dev/
  * https://mini-lang-expert.ccckmit.workers.dev/mini-lang-expert

Mini-Lang 專家：用 LLM（NVIDIA 的 GLM 5.3 Flash）回答 Mini-Lang 的問題、翻譯、寫文章，並在 Worker 裡執行字表（297 字）檢查工具的循環。**這個應用是自包含的**：所有前端與資料都在這個資料夾裡，部署不需要其他專案。

| 路徑 | 做什麼 |
|---|---|
| `/` | 轉到 `mini-lang-expert.html`（Mini-Lang 專家） |
| `/index.html` | 規則翻譯器（純前端） |
| `/api/chat` | 串流對話，並在 Worker 裡執行 `check_minilang` 工具的循環 |
| `/api/status` | 模型與金鑰狀態 |

## 檔案

| 檔案 | 說明 |
|---|---|
| `src/worker.js` | Worker：SSE 串流、檢查與查詞典工具、靜態資產 |
| `src/generated.js` | 字表、詞典與系統提示詞（原始檔，直接改也可以）。詞典不放進提示詞：Worker 只附上對話中出現的詞，其他讓模型用 `lookup_word` 查 |
| `public/` | 前端：專家頁、規則翻譯器、`data.js`（字表/詞典/拼音/範例）、翻譯引擎 |
| `wrangler.jsonc` | Worker 設定（名稱、靜態資產目錄） |
| `sync.py` | **可選**：從上游 mini-lm 專案同步前端與資料（見下方） |

## 部署

```bash
cd mini-lang-expert
npm install
npx wrangler login                      # 第一次才需要
npx wrangler secret put NVIDIA_API_KEY  # 貼上金鑰，只需一次
npx wrangler deploy
```

部署完打開 `https://mini-lang-expert.<你的子網域>.workers.dev/`。

本機測試：`npm run dev`，打開它印出的網址。
本機的金鑰放在 `.dev.vars` 檔案裡（一行 `NVIDIA_API_KEY=...`，已被 gitignore）：

```bash
echo "NVIDIA_API_KEY=..." > .dev.vars
```

網址：`/` 是規則翻譯器，`/mini-lang-expert` 是專家（Cloudflare 會把 `mini-lang-expert.html` 轉成不帶副檔名的路徑）。

## 修改內容

* **前端**：直接改 `public/` 下的檔案。
* **提示詞或詞典**：直接改 `src/generated.js` 的 `SYSTEM_PROMPT` / `LEXICON`，或 `public/data.js`。
* 改完 `npx wrangler deploy` 即可，沒有任何打包步驟。

## 和上游 mini-lm 專案的關係（可選）

這個應用最初是從 mini-lm 專案（`web/` 前端 + `mini-lang/` 字表詞典）打包出來的；現在已自包含，兩邊獨立演化。**上游有更新、想把最新版同步過來時**才用：

```bash
MINILM_REPO=/path/to/mini-lm npm run sync
```

注意：同步會覆蓋 `public/` 下對應的檔案，執行前先確認沒有本地要保留的修改。

## 和本機伺服器版的差別

* **提示詞打包進 Worker**：改了要 `npx wrangler deploy`。
  想不重新部署就改提示詞，可以在 `wrangler.jsonc` 加一個名為 `PROMPTS` 的 KV namespace，
  之後 `npx wrangler kv key put --binding=PROMPTS system_prompt --path prompt.txt`；Worker 會優先用 KV 裡的版本（快取 60 秒）。
* **免費方案的 CPU 限制是 10ms**，長回答的串流處理可能超過；建議用 Workers 付費方案（預設上限 30 秒 CPU，本 Worker 每個請求的 CPU 用量遠低於此）。詳見 `../doc/cpu-limit.md`。
* **API 是公開的**（有 CORS）：任何知道網址的人都能用你的 NVIDIA 額度對話。想限制來源，把 `src/worker.js` 的 `cors()` 改成只允許你的網域，或加上 Cloudflare 的 Rate limiting rule。

相關文件（方案、產品、發佈、金流）見 `../doc/`。
