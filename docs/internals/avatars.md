---
summary: The uniform avatar system — one uploaded square image (or initials) for agents and people alike, the shared contract, hosted vs local storage, and the shared React components.
read_when:
  - rendering an identity mark for an agent or a person anywhere in the app
  - changing avatar upload rules, storage, or the avatar URL contract
  - adding a surface that shows who authored or owns something
---

# Avatars

Agents and people share **one** identity mark: a square image the owner
uploads, or initials when there is none. There is no agent-specific art and no
agent-vs-human branch at any call site.

## Contract

`packages/tavern-api/src/avatar.ts` (`@tavern/api/avatar`) owns the rules:

- `avatarMediaTypes` — `image/jpeg`, `image/png`, `image/webp`. Nothing else is
  accepted, and the server re-checks the magic signature against the declared
  media type.
- `avatarPixelSize` (256) — clients resize to at most this square before
  upload. The original is never stored.
- `avatarMaxBytes` (512 KiB) — checked after the client resize and again on the
  server.
- `avatarIdSchema` / `isAvatarId` — hosted ids are `avt_` + 16 lowercase
  alphanumeric characters.

Every record that can wear an avatar exposes **`avatarUrl: string | null`** —
an absolute-or-relative URL a surface drops straight into an `<img src>`. Call
sites never see an avatar id, media type, or byte payload. This holds for
`Agent`, `ServerMember`, and the local agent catalog item alike.

## Storage

**Hosted (Postgres).** Bytes live in an `avatars` table
(`id`/`media_type`/`byte_size`/`sha256`/`bytes`/`created_at`); `agents.avatar_id`
and `users.avatar_id` point at it with `on delete set null`. Writes go through
`avatar.set` / `avatar.clear` (`apps/server/src/grotto-api/avatar/`, backed by
`apps/server/src/avatars/`) with the bytes base64-encoded on the ordinary tRPC
call — 512 KiB is far under the body limit, so no attachment reservation is
involved. Setting takes the Server row lock, authorizes (owner/admin for an
Agent, self for a person), inserts the new row, repoints the owner, and deletes
the replaced row in the same transaction, so a row exists only while something
wears it.

The hosted table permits a release-owned image up to 2 MiB so the exact Cove
avatar can be assigned byte-for-byte by the Server factory operation. Ordinary
human and Agent uploads remain limited to `avatarMaxBytes` (512 KiB) and still
flow through `avatar.set`; this internal asset allowance does not widen the
upload contract or create a Cove-specific renderer.

Reads are `GET /api/avatars/:avatarId`, unauthenticated on purpose — an `<img>`
cannot carry a bearer token, ids are opaque, and every replacement mints a fresh
id. The response is `immutable`-cached for a year. `avatarUrlFor` builds the URL
projections emit.

**Local (SQLite).** The local app is single-user, so `agents.avatar_url` stores
a small `data:` URL directly; `identity_users.avatar_url` does the same for the
person. The runtime write path is `PATCH /agents/:id/avatar` with
`{ avatarUrl: string | null }`, which returns the updated agent.

## Rendering

- `EntityAvatar` (`components/ui/entity-avatar.tsx`) is the only identity mark
  in the app — rail, sidebar rows, mention chips, transcript, profile pages.
  A stock HeroUI `Avatar` at `sm` (32px), `md` (40px), or `lg` (48px), with
  `<Avatar.Image>` only when `src` is set and an always-present initials
  fallback. `className` is for layout offsets only, never for restyling.
  Pass a **number** for slots below HeroUI's 32px floor (contextual sidebar rows
  at 24px, mention chips at 16px, thread reply previews at 20px); the exact box
  arrives as inline style, which is the one place this primitive reaches past
  the variant. Do not add a second avatar component for small sizes.
- Servers currently use initials rather than an uploaded image. Every Server
  surface renders those initials through `EntityAvatar` at the stock `sm`
  size; do not pass an exact numeric size from a Server call site.
- Avatar shape and styling are HeroUI defaults. Do not override `.avatar`
  globally or introduce an app-specific radius token. `ChannelIconBox` uses
  the stock `rounded-lg` utility for the adjacent Channel mark.
- `AgentAvatar` composes `EntityAvatar` with the stock HeroUI `Badge.Anchor` and
  an empty `Badge` availability dot. Its live-Agent input requires the
  canonical `Agent.availability`; it has no unknown or missing-status variant.
  Historical or unresolved authors render `EntityAvatar` without a status
  badge. Availability decoration belongs here; do not add a second status-dot
  primitive. Offline uses the theme's stronger `muted` fill because HeroUI's
  pale `default` fill disappears on sidebar surfaces.
- `getEntityInitials(name)` is the single initials algorithm: empty → `?`, one
  word → its first two letters, otherwise first + last initial. Handle an empty
  display name at the call site (e.g. `name={displayName || 'You'}`) rather
  than reintroducing a local variant.

## Uploading

`features/avatars/` owns the whole upload experience for both humans and
Agents. `readAvatarImage(file)` validates the media type, center-crops to a
square, resizes down to `avatarPixelSize` (it never upscales), re-encodes in the
source media type, enforces `avatarMaxBytes`, and returns `{ base64, blob,
dataUrl, mediaType }` — one canvas encode serving both the hosted upload and the
local data URL. `AvatarPicker` wraps that in a stock HeroUI `Button` +
`Tooltip` around `EntityAvatar`, and reports failures through `onError` so each
caller presents them in its own idiom.
