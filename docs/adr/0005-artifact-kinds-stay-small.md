---
summary: Decision to keep ChatArtifact.kind limited to document, image, and custom.
read_when:
  - changing chat artifact kinds, artifact rendering, or Artifact Panel target classification
---

# Artifact Kinds Stay Small

Grotto chat artifacts use a small product enum: `document`, `image`, and
`custom`.

We are not keeping separate artifact kinds for code, diffs, files, charts, or
plain text because those are not distinct Grotto product surfaces today:
charts belong to Widgets, diffs are not a Grotto review surface, code
and text can be document content, and generic files should become a supported
document/image type or fall back to `custom`.

Artifact rendering uses the artifact's `mime_type` and `content_ref` extension
where format matters. The Artifact Panel may also open non-artifact targets
such as Wiki pages or workspace files; those targets do not expand
`ChatArtifact.kind`.
