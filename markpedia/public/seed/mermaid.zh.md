> 分類：[工學門](#/p/cat-gong) › [資訊技術](#/p/cat-info-tech)

## Mermaid 是什麼

**Mermaid** 讓你用純文字描述流程圖、時序圖、甘特圖……直接寫在 Markdown 的
```` ```mermaid ```` 程式碼區塊裡，由前端渲染成 SVG。原始碼就是文字，
適合放進版本控制，Markpedia 的條目因此能直接內嵌圖表。

## 流程圖

```mermaid
flowchart TD
  A[讀取 Markdown 原稿] --> B{是 mermaid 區塊嗎}
  B -->|是| C[交給 Mermaid 渲染]
  B -->|否| D[照一般語法渲染]
  C --> E[產生 SVG]
  D --> E
  E --> F[合進頁面]
```

## 時序圖

```mermaid
sequenceDiagram
  participant U as 使用者
  participant B as 瀏覽器
  participant K as KaTeX
  participant M as Mermaid
  U->>B: 打開一篇條目
  B->>K: 掃描行內與整段數學 $..$
  B->>M: 掃描 mermaid 區塊
  K-->>B: 數學排成 HTML 與 SVG
  M-->>B: 圖表畫成 SVG
  B-->>U: 渲染完成
```

## 圓餅圖

```mermaid
pie title 本站範例條目的內容元素占比（示意）
  "表格" : 25
  "數學公式" : 25
  "mermaid 圖表" : 50
```

## 寫法備忘

- 區塊以 ```` ```mermaid ```` 三個反引號開頭，語法錯誤會整塊渲染失敗。
- 安全考量：本站以 strict 模式渲染，mermaid 內的 HTML 會被跳脫。

## 相關條目

- [Markdown 記法](#/p/markdown)
- [Cloudflare Workers](#/p/cloudflare-workers)
