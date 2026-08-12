# Design battery rubric

Judge each battery screenshot against these checks. The battery passes when
every item passes every applicable check without per-item coaching. Source of
truth for the rules: the seeded visuals skill
(`packages/agent-workspace/src/visuals-skill/`) and DESIGN.md.

## Every item

- [ ] Theme native: only token colors; correct in both dark and light shots;
      no hardcoded hex, no alien fonts.
- [ ] Ink-first: chrome and text are foreground/gray; accents appear only for
      status, series, or one deliberate emphasis moment.
- [ ] Flat: no gradients, shadows, glows, 3D, decorative backgrounds, or
      nested decorative cards.
- [ ] Typography: two weights (400/500), sentence case everywhere, nothing
      below 11px, numbers tabular, no mono hero metrics.
- [ ] Spacing on the 4/8/12/16/20/24/32 scale; nested radii outer > inner.
- [ ] Text fits: no overflow, truncation, or text touching box edges; labels
      readable in both themes.
- [ ] Nothing clipped by the viewBox or card; no dead vertical space.
- [ ] Restraint: within complexity budgets (≤5 hues, ≤5 tiles per row,
      captions ≤12 words); no emoji-as-icons; icons ≤24px.

## Charts (bar, line, composed, sparkline, dashboard)

- [ ] Series colors follow the categorical order (chart-1 blue first);
      single-metric uses chart-1; comparable series use same-hue opacity.
- [ ] Text never wears the series color.
- [ ] Horizontal gridlines only; muted 11–12px axis labels; legend only when
      >1 series.
- [ ] Leads with the answer (headline number or takeaway above the chart).
- [ ] Compact units (1.2k, $4.5M); deltas use success/error foregrounds.

## Stat tiles / KPI rows

- [ ] Label (12px muted) → value (24–32px, 500, tabular) → delta hierarchy.
- [ ] Tiles are bordered or surface-filled, not shadowed cards.

## Diagrams (flowchart)

- [ ] Nodes on surface-3 with border-strong hairlines; consistent flow
      direction; even gaps; connectors stop at node edges.
- [ ] Status is semantic only (success/warning/error); at most one
      highlighted node; the failure point is obvious at a glance.

## Interactive (calculator)

- [ ] Controls neutral (no browser default blue); values update live;
      layout stable while dragging; motion uses the motion tokens.

## Artifact pages

- [ ] Page owns its ground (background token), panels on card/surfaces.
- [ ] Layout rhythm: constrained prose width, full-width tables/charts,
      more space between sections than within.
- [ ] Tables: horizontal dividers only, sentence-case headers, right-aligned
      numbers, compact mono metadata.
- [ ] Reads operational, not editorial: no hero sections, no marketing tone.

## Process (from the transcript, not the screenshot)

- [ ] The agent read the visuals skill before its first fence.
- [ ] Prose around the fence adds context without restating the visual.
- [ ] No narration after the visual rendered.
