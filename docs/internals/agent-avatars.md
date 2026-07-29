---
summary: How to add or update an agent character avatar (AgentFace) — the two files to touch, the shared 1000x1000 core-fit frame, per-head eyes, and current character registry.
read_when:
  - adding a new agent character/avatar or updating an existing one's face art
  - changing AgentFace, head art, eye placement, or the agentCharacters contract
  - authoring 1000x1000 head SVGs for agents
---

# Agent Avatars

Agents render as a **character face** via `AgentFace`. Adding or changing a
character is a two-file change. Head art is authored on a shared 1000x1000
canvas; the engine's animated eyes drop into per-head positions and can be
clipped or occluded by the head art.

## The two files

- **Art** — `apps/website/src/features/chats/agent-face.tsx`: the SVG path
  constants, warp layers, and the `HEADS` registry.
- **Contract** — `packages/tavern-api/src/agent-appearance.ts`: `agentCharacters`
  (the id list) and `agentCharacterLabels`. This list is the single source of
  truth — it drives the Settings picker, persistence, Runtime validation, and
  default-avatar assignment. Every avatar surface reads from it automatically.

## Frame contract

- Head art is a **1000x1000** Fable export. Every export shares the same inner
  **core box** (the hidden 605x605 guide the artist keeps in-frame), so heads
  line up regardless of their outer silhouette. `FIT` maps that core box onto
  the internal **480** frame once, for every head, via `buildWarpLayers(FIT,
  …)` — so heads come out consistently sized without per-head fit math.
- The rendered footprint is the core box (the 480 frame); parts that reach past
  it — the knight plume, robot ears, star points — **overflow** the frame and
  paint outside it (`overflow: visible`), so tall/wide pieces read
  asymmetrically without enlarging the layout box. Containers must not clip.
- Art layers carry their own transform: `buildWarpLayers(FIT, [{ d, tf, fill }])`
  composes `FIT ∘ tf` per layer. Use `front` layers for art that should occlude
  the eyes (beaks, mouths, the knight's face plate); `clip` keeps eyes inside a
  face window (robot screen, alien sockets).
- **Eyes are per-head, not on a single standard spot.** Each head carries a
  `slot: { dx, dy, s }` (spacing + offset) and `eyeScale: { w, h }` that
  reproduce that head's artist-drawn eyes. Author by reading the drawn eye
  centers/size (in the 480 frame after `FIT`): `s` = eye spacing / 242,
  `dx`/`dy` = eye midpoint − 240, `eyeScale` = drawn eye size / (base × `s`)
  where base is `89.148 × 153.526`. `EYE_FRAME` remains only as the fallback
  slot for the eyes-only `none` head.
- **Two eye variants.** The default is the tall capsule (owl, robot, bird,
  blob, knight). The **circular** variant (alien) is the same engine eye made
  round via `eyeScale` (near-square w/h so the corners saturate to a circle)
  and clipped to round white sockets — socket = art, iris = engine eye,
  glint = engine highlight, giving the concentric look.
- Occlusion is geometry, not a flag: place the eye so its edge crosses a front
  layer. The knight's drawn eyes sit low enough in the visor slot that their
  bottoms extend past the face plate's window edge, so the plate occludes ~15%
  at rest (eyes "behind the lower visor").
- `thirdEye: { dx, dy }` adds a live center eye (eye-canvas offset from the
  pair). Its pose is the L/R average, so it blinks and tracks gaze with them
  (the alien's forehead eye).
- `AgentFace` still accepts `ink` for currentColor marks, but current
  characters use authored fill colors and render the same in light/dark.

## Add a character

1. Export the head at **1000x1000** keeping the shared core guide in-frame, with
   reference eyes drawn where they should sit. Keep the head silhouette + any
   occluders; the drawn eye/socket subpaths are only references.
2. In `agent-face.tsx`, register the art via `buildWarpLayers(FIT, [{ d, tf,
   fill }])` (per-layer `tf` from the export), then read the drawn eye
   centers/size to compute `slot` + `eyeScale`. Register in `HEADS`:
   ```tsx
   xyz: (_dark: boolean) => ({
     back: [],
     front: [],
     warp: XYZ_WARP,
     eyeColor: "#000000",
     eyeScale: { w: 1.2, h: 1.2 },
     hlColor: "#fcfcfd",
     slot: { dx: 0, dy: 20, s: 0.86 },
   }),
   ```
3. In `agent-appearance.ts`, add the id to `agentCharacters` and a label to
   `agentCharacterLabels`.
4. Verify: `bun run --filter @tavern/website typecheck` (TypeScript enforces that
   every `agentCharacters` id has a matching `HEADS` entry — this is the sync
   safety net), then `bun run lint`.

## Rendering a face

Call sites resolve the agent's appearance via `useAgentAppearanceLookup` (or the
agent record's `effectiveCharacter` / `effectivePrimaryColor`) and pass both
theme and ink:

```tsx
<AgentFace dark={dark} head={character} ink={resolveAgentInk(dark, primaryColor)} … />
```

## Update an existing avatar

Replace that head's art constant in `agent-face.tsx`. No contract change.

## Notes

- Adding is additive — `character` is a stored string enum, so there is no
  migration. Renaming or removing a character orphans agents already set to it;
  prefer adding.
- Hosted surfaces render the Server-persisted `character`; they do not derive a
  default from the Agent id after creation.
- Current characters are `knight`, `owl`, `bird`, `robot`, `alien`, and `blob`.
