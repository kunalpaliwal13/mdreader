---
title: Welcome to mdreader
author: you
tags: [markdown, notes, docs]
---

# Welcome to mdreader

A minimal, offline markdown workspace. Everything stays in your browser. This page shows every
syntax the renderer understands — edit it freely, it's just a file. Front matter can give a note its own look:
`preset: sepia` or `font: serif`.

[[toc]]

## Text

**Bold**, *italic*, ***both***, ~~strikethrough~~, __underline__, ==highlight==,
`inline code`, H~2~O subscript, E = mc^2^ superscript, ||spoiler|| and emoji :rocket: :sparkles: :tada:.

Autolinks: https://commonmark.org and <mail@example.com>. A [relative link](#tables) jumps inside
the doc. A hard break ends this line\
and continues here.

## Links between notes

Wikilinks connect files: [[Welcome]] points back here, and [[My first note|this one]] doesn't exist
yet — click it in the preview to create it. Type `[[` in the editor to autocomplete file names. The
**Outline** tab in the sidebar shows headings and every file linking here.

[[Welcome#Tables]] links straight to a heading (type `[[note#` for suggestions), `![[note]]` or
`![[note#Heading]]` embeds another note or one section of it, and hovering a note link previews it.
Tags like #ideas or #reading/books group notes — click one, or open **Search** with nothing typed to see them all.

## Daily notes & templates

The calendar icon in the sidebar opens today's note (`Daily/YYYY-MM-DD.md`). Notes in a `Templates/` folder show
up in the `/` menu and the command palette, with `{{date}}`, `{{time}}`, `{{title}}` and `{{cursor}}` filled in;
a `Templates/Daily.md` shapes every new daily note.

## Lists

- Unordered item
  - Nested item
    - Deeper
1. Ordered
2. Items
   1. Nested ordered

### Tasks

- [x] Write the renderer
- [ ] Ship it
- [ ] Celebrate :partying_face:

## Tables

| Feature     | Status | Notes            |
| :---------- | :----: | ---------------: |
| GFM tables  |   ✅   | aligned columns  |
| Footnotes   |   ✅   | see below[^1]    |
| Math        |   ✅   | KaTeX            |
| **+ FP8**   |   ✅   | *bold in cells*  |

## Quotes & alerts

> A plain blockquote.
> > Nested quote.

> [!NOTE]
> Useful information users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.

>>>
A multiline block quote,
written without a `>` on every line.
>>>

## Code

```ts
// syntax highlighted
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

```python
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

```bash
echo "shell too" | tr a-z A-Z
```

## Math

Inline $e^{i\pi} + 1 = 0$ and display:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

```math
\begin{bmatrix} a & b \\ c & d \end{bmatrix}
```

## Diagrams

```mermaid
graph LR
  A[Write] --> B{Render}
  B -->|WASM| C[Preview]
  B -->|Export| D[PDF / HTML]
```

```mermaid
sequenceDiagram
  You->>mdreader: type markdown
  mdreader-->>You: live preview
```

## Definition lists

Markdown
: A lightweight markup language.

WASM
: A portable binary format that runs in the browser.

## Footnotes

Here is a footnote reference[^1] and an inline one^[Inline footnotes work too.].

[^1]: The footnote text lives at the bottom.

## HTML

<details>
<summary>Click to expand</summary>

Raw HTML is allowed and sanitized. <kbd>⌘</kbd> + <kbd>B</kbd> makes text bold.

</details>

## Images

![A placeholder](https://placehold.co/600x120/png?text=mdreader)

Paste or drop an image into the editor to save it in an `assets/` folder next to this file.

---

*Horizontal rule above.* Happy writing.
