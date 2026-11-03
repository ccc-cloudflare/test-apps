# 發佈流程

> 把應用部署到 Cloudflare Workers（第一次與之後的更新）。以 [mini-lang-expert/](../mini-lang-expert/) 為例。

## 1. 第一次部署

```bash
cd mini-lang-expert
npm install                             # 安裝 wrangler
npx wrangler login                      # 授權 Cloudflare 帳號，第一次才需要
npx wrangler secret put NVIDIA_API_KEY  # 貼上金鑰，只需一次
npx wrangler deploy                     # 部署
```

部署完 wrangler 會印出網址（`https://mini-lang-expert.<你的子網域>.workers.dev`）。

* **金鑰**存在 Cloudflare 的密鑰裡，不在程式碼中；`deploy` 不會動它，換機器也不用重新設。
* **本機測試**用 `npm run dev`，金鑰放在 `.dev.vars`（已被 gitignore）：

  ```bash
  echo "NVIDIA_API_KEY=..." > .dev.vars
  ```

## 2. 之後的更新

| 改了什麼 | 指令 |
|---|---|
| 任何檔案（`src/worker.js`、前端、提示詞、詞典） | `npx wrangler deploy` |
| `wrangler.jsonc`（設定） | `npx wrangler deploy` |

**已經部署過的話，之後每次更新就只有一步：`npx wrangler deploy`。**

其他步驟何時需要：

| 步驟 | 何時 |
|---|---|
| `npm install` | 新機器、刪過 `node_modules`、或 `package.json` 改動 |
| `npx wrangler login` | 第一次授權之後一直有效 |
| `secret put` | 只需一次（換金鑰時再跑一次） |

## 3. 在其他機器重建

這個應用是**自包含的**：`public/` 與 `src/generated.js` 都是 commit 進 git 的原始檔，clone 下來就能直接部署，不需要其他專案或打包步驟：

```bash
git clone <這個 repo>
cd test-apps/mini-lang-expert
npm install
npx wrangler secret put NVIDIA_API_KEY
npx wrangler deploy
```

## 4. 發佈的行為

* **原子性**：deploy 之前線上版完全不變，deploy 完立即切換，沒有中間狀態。
* **靜態資產隨 Worker 一起走**：`public/` 的檔案在 deploy 時一起上傳，不是另外的服務。

## 5. 出錯時

```bash
npx wrangler rollback                   # 退回上一版（立即生效）
npx wrangler tail                       # 看 Worker 的即時 log
npx wrangler deployments list           # 列出歷次部署
```

也可以在 dashboard → Workers → 該 Worker → Deployments 頁面回溯。

## 6. 從上游 mini-lm 同步（可選）

這個應用原本是從 mini-lm 專案打包出來的，現在已獨立。上游有更新、想把最新版同步過來時才用（會覆蓋 `public/` 下對應的檔案）：

```bash
MINILM_REPO=/path/to/mini-lm npm run sync
```

## 7. 提示詞不重新部署的更新法（可選）

在 `wrangler.jsonc` 加一個 `PROMPTS` KV namespace（檔案內有註解範例），之後改提示詞只要：

```bash
npx wrangler kv key put --binding=PROMPTS system_prompt --path prompt.txt
```

Worker 會優先讀 KV 裡的版本（快取 60 秒），不用改檔、不用 deploy。

## 8. 上線前的檢查清單

- [ ] `npx wrangler secret put NVIDIA_API_KEY` 已設定（`/api/status` 回 `key: true`）
- [ ] 公開 API 的保護：`cors()` 限制來源，或加上 Rate limiting rule（見 [plans.md](plans.md#5-免費額度的共同陷阱)）
- [ ] 免費方案注意 CPU 限制，長串流建議 Workers Paid（[cpu-limit.md](cpu-limit.md)）
