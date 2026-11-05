> 分類：[工學門](#/p/cat-gong) › [資訊技術](#/p/cat-info-tech)

## 什麼是 Markdown

**Markdown** 是一種輕量級標記語言：用簡單的符號寫出文件結構，再由渲染器轉成 HTML。
維基式條目、README、技術文件常用 Markdown。Markpedia 的每篇條目都是用
**GitHub Flavored Markdown（GFM）** 寫的。

## 基本語法

| 語法 | 效果 |
| --- | --- |
| `# 標題` | 一到六級標題 |
| `**粗體**` 與 `*斜體*` | **粗體** 與 *斜體* |
| `` `程式碼` `` | 行內 `code` |
| `- 項目` / `1. 項目` | 無序／有序清單 |
| `> 文字` | 引用 |
| `[連結文字](https://example.com)` | 超連結 |
| ` $E = mc^2$ ` | 行內數學 |
| ```` ```mermaid ```` | mermaid 圖表區塊 |

## 程式碼區塊

用三個反引號開頭與結尾，標註語言可以有語法高亮：

```javascript
// 有語法高亮的程式碼區塊
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
```

## 數學公式

行內數學寫成 ` $...$ `，**兩個錢號外側要留空白**，本站的提示與 GitHub 都遵循這個慣例。
例如：光速 $c$ 約為 $3 \times 10^8$ 公尺每秒，重力常數 $G$ 則小得多。

整段公式用 `$$...$$`：

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}\,(x - a)^n
$$

## 連往其他條目

站內連結直接寫成 `[文字](#/p/slug)`，例如 [Mermaid 圖表](#/p/mermaid)、
[質能等價](#/p/mass-energy-equivalence)。
