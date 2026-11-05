# Markpedia

用 Markdown 寫的「維基百科式」知識庫，跑在 Cloudflare Workers 上。

* 每篇條目是一份 **GitHub Flavored Markdown** 原稿，存在 D1，
  支援表格、程式碼區塊、**KaTeX 數學**（前端渲染）與 **mermaid 圖表**
* 每個條目有 **繁體中文版（zh）** 與 **英文版（en）** 兩種語言版本，可切換
* 可新增、修改、刪除、搜尋（標題與全文 LIKE），另有隨機條目
* 前端用 marked + DOMPurify + KaTeX + mermaid（皆由 CDN 載入），渲染順序固定為
  GFM → mermaid → 數學，先把 mermaid 區塊搬走才掃數學

寫條目的慣例：**行內數學 `$...$` 的兩側要留一個空白**，GitHub 與本站才會正確
渲染；seed 條目全部符合這條規則，改動 seed 時也要維持。

## 檔案

```
src/worker.js     API：GET /api/entries、POST /api/entries、
                  GET/PUT/DELETE /api/entry/{slug}、GET /api/random
                  資料表是空的時候會從 public/seed/ 自動灌範例條目
public/           前端 SPA（hash 路由：#/、#/new、#/p/{slug}、#/edit/{slug}）
public/seed/      5 個範例條目的 zh+en 原始 Markdown（共 10 檔）
schema.sql        D1 結構（entries：slug+lang 複合主鍵）
```

## 本機開發

```bash
npm install        # 只在新機器或依賴改動時
npm run db         # 建立/更新本機 D1 表（首次）
npm run dev        # wrangler dev 於 http://localhost:8787
```

煙霧測試：

```bash
curl localhost:8787/api/entries                       # 應回 10 篇範例條目
curl 'localhost:8787/api/entry/markdown?lang=zh'      # 應回 Markdown 原稿 JSON
curl -X POST localhost:8787/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"slug":"t1","lang":"zh","title":"T","body":"B"}'   # 應回 201
curl -X DELETE localhost:8787/api/entry/t1              # 應回 {"deleted":1}
```

重灌範例條目（seed 只在資料表是空的時灌入）：

```bash
npx wrangler d1 execute markpedia-db --local --command "DELETE FROM entries"
```

## 部署

```bash
npx wrangler d1 create markpedia-db                  # 把輸出 id 填入 wrangler.jsonc
npm run db-remote                                    # 線上建表
npx wrangler deploy                                  # 上線（首次請求會自動灌範例）
```

沒有 secret：markpedia 不需要登入，任何打到 Workers 的人都能編輯（自用維基的定位）。
