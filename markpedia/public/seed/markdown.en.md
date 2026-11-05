> Filed under: [Engineering & Technology](#/p/cat-gong) › [Information technology](#/p/cat-info-tech)

## What Markdown is

**Markdown** is a lightweight markup language: you describe document structure with simple
symbols and a renderer turns it into HTML. Wikis, READMEs and technical docs all use it.
Every article on Markpedia is written in **GitHub Flavored Markdown (GFM)**.

## Basic syntax

| Syntax | Effect |
| --- | --- |
| `# Heading` | Headings level 1 to 6 |
| `**bold**` and `*italic*` | **Bold** and *Italic* |
| `` `code` `` | Inline `code` |
| `- item` / `1. item` | Unordered / ordered list |
| `> text` | Blockquote |
| `[link text](https://example.com)` | Hyperlink |
| ` $E = mc^2$ ` | Inline math |
| ```` ```mermaid ```` | Mermaid diagram block |

## Fenced code blocks

Wrap the code in triple backticks and name the language for highlighting:

```javascript
// A fenced code block with syntax highlighting
function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
```

## Math formulas

Inline math is written as ` $...$ `, and **both dollar signs need a surrounding space**;
this site's hint and GitHub follow the same rule. For example, the speed of light $c$ is
about $3 \times 10^8$ meters per second, while the gravitational constant $G$ is far smaller.

Display math uses `$$...$$`:

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}\,(x - a)^n
$$

## Internal links

Link to other articles with `[text](#/p/slug)`, e.g. [Mermaid diagrams](#/p/mermaid)
and [Mass-energy equivalence](#/p/mass-energy-equivalence).
