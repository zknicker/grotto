# Plans

## Chat status motion refinements (animation audit)

| Plan | Title | Severity | Status |
| --- | --- | --- | --- |
| [009](009-hint-scale-origin.md) | Anchor the busy-elsewhere hint's scale to its content column | MEDIUM | DONE |
| [010](010-section-exit-cohesion.md) | Fade the status section; one spring vocabulary | MEDIUM | DONE |
| [011](011-hardware-transform-and-stagger.md) | Hardware-accelerated row transforms + entry stagger | LOW | DONE |
| [012](012-status-label-crossfade.md) | Crossfade status label/icon changes; soften presence dots | LOW | DONE |

Execution order: 010 → 011 (011 references `statusRiseOut` exported by 010),
then 009 and 012 in any order. No dependency on 006–008.

Retired investigation notes are intentionally not kept here. Durable decisions
belong in `docs/adr/`; active product contracts belong in `specs/` or `docs/`.
