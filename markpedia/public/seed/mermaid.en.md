> Filed under: [Engineering & Technology](#/p/cat-gong) › [Information technology](#/p/cat-info-tech)

## What Mermaid is

**Mermaid** lets you describe flowcharts, sequence diagrams and Gantt charts as plain text,
right inside a ```` ```mermaid ```` code fence in Markdown; the frontend renders them as SVG.
Because the source is plain text it is friendly to version control, which is why articles on
Markpedia can embed diagrams directly.

## Flowchart

```mermaid
flowchart TD
  A[Read Markdown source] --> B{Is it a mermaid block}
  B -->|Yes| C[Hand it to Mermaid]
  B -->|No| D[Render as ordinary GFM]
  C --> E[Produce SVG]
  D --> E
  E --> F[Insert into page]
```

## Sequence diagram

```mermaid
sequenceDiagram
  participant U as User
  participant B as Browser
  participant K as KaTeX
  participant M as Mermaid
  U->>B: Open an article
  B->>K: Scan inline and display math
  B->>M: Scan mermaid blocks
  K-->>B: Typeset math as HTML and SVG
  M-->>B: Draw diagrams as SVG
  B-->>U: Rendering complete
```

## Pie chart

```mermaid
pie title Structure of the seeded sample articles
  "Tables" : 25
  "Math formulas" : 25
  "Mermaid diagrams" : 50
```

## Notes

- A block starts with the triple-backtick ```` ```mermaid ```` fence; syntax errors fail the whole block.
- For safety this site renders mermaid in strict mode, so embedded HTML is escaped.

## Related articles

- [Markdown syntax](#/p/markdown)
- [Cloudflare Workers](#/p/cloudflare-workers)
