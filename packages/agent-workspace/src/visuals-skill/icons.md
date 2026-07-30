# Tavern visuals — icon system

Read this when an output uses icons — buttons with icons, toolbars, status
markers, or any icon-bearing element. The skill ships a curated set of
Tavern's app icons as inline-ready SVG (solid rounded style, the same family
the app itself uses).

## Where icons live

- `assets/icons/*.svg` — the icon files (24×24 viewBox, `currentColor`)
- `references/icons/manifest.json` — the index: `name`, `file`, `category`,
  `aliases`, `use_for`, `avoid_for`

## How to use an icon

The frame allows no imports, no modules, and no external assets — **inlining
the SVG is the only correct way**. Copy the SVG content from `assets/icons/`
directly into the markup. Keep `fill="currentColor"` so the icon follows the
surrounding text color and both themes for free.

```html
<button aria-label="Search" style="color: var(--muted-foreground)">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="..." fill="currentColor"/>
  </svg>
</button>
```

Set the rendered size via `width`/`height` (or CSS); never edit the
`viewBox` and never restyle the path data.

## Selection flow

1. Identify the UI intent ("search", "delete", "download").
2. Search `references/icons/manifest.json` by `aliases`, `category`, and
   `use_for` (grep is enough).
3. Check `avoid_for` to eliminate wrong matches — do not use an upload icon
   for "download" or a share icon for "export to file".
4. Read the matched file from `assets/icons/` and inline it.

If no icon matches the semantic need, build a custom one following the
construction rules below — do not substitute a vaguely-related icon, and
never draw from memory of Lucide / Material / FontAwesome shapes.

## Style & construction (also for custom icons)

- **Type**: solid rounded — filled shapes with softly rounded corners,
  matching the app's icon language
- **Grid**: 24×24 viewBox
- **Color**: `currentColor` only — no hard-coded hex, no gradients, no
  shadows
- Custom icons must be visually indistinguishable in weight and style from
  the library ones; reference a shipped icon of similar complexity as the
  construction guide

## Size

Icon size follows the host element, not arbitrary choice:

| Context | Icon size |
| --- | --- |
| Inline with 14px body text | 14–16px |
| Default buttons, chips, tabs (~32px controls) | 16px |
| Toolbar buttons, primary actions | 18px |
| Standalone icon buttons | 18–24px |
| Badge dots / micro indicators only | 12px |

Icon containers are square (`width == height`) for optical alignment. Do
not scale outside this table.

**24px is the hard ceiling.** If a spot seems to call for a larger icon —
an empty-state illustration, a hero mark, a big decorative glyph in a stat
card — that is not an icon use case: drop the icon entirely and solve it
with typography, a number, or plain text hierarchy instead. Never work
around the ceiling by drawing a "bigger custom icon".

## Color

- Default: `currentColor`, inheriting the text color of the context
  (`--foreground` for high-emphasis, `--muted-foreground` /
  `--foreground-tertiary` for supporting icons)
- Semantic overrides only: destructive `--error`, success `--success`,
  warning `--warning`, disabled `--foreground-quaternary`
- Icons are UI chrome under the ink-first rule — never a chart series color
  or `--brand` for a generic icon

## Accessibility

- Icon-only buttons need an accessible name: `aria-label` or visually
  hidden text.
- Decorative icons get `aria-hidden="true"`.
- Loading spinners expose `aria-busy="true"` on the parent control.

## Don't

- Do not use emoji as UI icons.
- Do not render any icon larger than 24px.
- Do not fetch, link, or import icons from anywhere — inline only.
- Do not use external icon libraries' shapes when a library icon exists for
  the intent.
- Do not guess meaning from the filename alone — check the manifest's
  `use_for`/`avoid_for`.
- Do not put more than one leading + one trailing icon in a single button.
