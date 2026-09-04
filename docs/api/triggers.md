---
summary: The public inbound Trigger route, managed Agent Trigger routes, the operator Trigger tRPC procedures, and the automation provenance carried on an Agent's message.
read_when:
  - changing the inbound Trigger route, its status codes, headers, or limits
  - changing managed Agent Trigger routes, secrets, or fire log reads
  - changing operator Trigger creation, editing, status, rotation, test fires, or deletion
  - changing message provenance, the `cause` field, or `automation.fireContext`
---

# Triggers API

A Trigger is an Agent-owned inbound wake (ADR 0027). Four surfaces touch it: the
public route an outside system calls, the managed Agent routes an Agent uses on
its own Triggers, the operator tRPC procedures behind the Agent profile's
Automations tab, and the provenance surface that carries a fire onto the Agent's
own message (ADR 0026), which reminders share. The two authoring surfaces share
one core and manage the same rows. Wire schemas live in
`packages/grotto-api/src/triggers.ts`, where `triggerKindSchema` is
`z.enum(['webhook'])`.

## Public inbound route

```http
POST /api/triggers/{triggerId}
Authorization: Bearer grtt_<base64url>
Idempotency-Key: <optional, ≤ 200 chars>
```

This is the only first-party route authenticated by a per-Trigger bearer secret
instead of Clerk, a Computer credential, or an Agent runner credential. The
Server resolves the row by `sha256(secret)` and requires the path id to match
that row. It is registered before tRPC and before the static App's not-found
handler.

The body is raw text or JSON under any content type and may be empty. A
route-scoped `*/*` parser captures the raw string; the Server stores it verbatim
and never parses it for semantics. It must be storable text: valid UTF-8 with no
NUL byte, since PostgreSQL `text` cannot hold one. Only the excerpt carried in
the Agent's envelope is altered: it arrives under a provenance line marking it as
untrusted data, with every payload line indented two spaces so a body cannot forge
an envelope header line, and the envelope's last line is
`reply with: grotto message send --cause <fireId>`. See
[specs/triggers.md](../../specs/triggers.md) for the exact envelope.

A fire writes no Chat message and emits no durable event. It records the fire and
enqueues the Agent's pending work; whether anything appears in a conversation is
up to the Agent's answer.

| Status | Body | Meaning |
| --- | --- | --- |
| `202` | `{ type: 'trigger_fire', triggerId, fireId }` | New fire recorded and dispatched |
| `200` | `{ type: 'trigger_fire', triggerId, fireId, duplicate: true }` | `Idempotency-Key` matched an existing fire for this Trigger |
| `400` | `{ code: 'invalid_idempotency_key' }` | `Idempotency-Key` over 200 characters; it is refused, not dropped |
| `401` | `{ code: 'unauthorized' }` | Missing or invalid secret, and unknown trigger id |
| `409` | `{ code: 'trigger_disabled' }` | The Trigger is disabled |
| `409` | `{ code: 'trigger_unavailable' }` | Owner Agent inactive or anchor no longer writable; the Trigger is disabled by this request |
| `413` | `{ code: 'payload_too_large' }` | Body over 65,536 bytes |
| `415` | `{ code: 'unsupported_media_type' }` | Body is not valid UTF-8, or contains a NUL byte |
| `429` | `{ code: 'rate_limited' }` plus `Retry-After` | Over 10 fires per 10 seconds or 60 per rolling hour, counted per Trigger |

The route answers in a fixed order: header and body shape first, so `400`,
`413`, and `415` answer any caller; then the bearer secret, so an unknown
trigger id answers `401` rather than `404` and the route never reveals whether a
Trigger exists; then an `Idempotency-Key` replay, answered from the recorded
fire without consuming rate-limit budget; then the rate limit; then
`trigger_disabled`; and only then the fire itself. A request refused before the
limiter costs nothing, and everything reaching the limiter is metered — a
disabled Trigger cannot be hammered for free.

## Managed Agent routes

Managed Agents reach these through Computer's loopback proxy with the scoped
runner credential, like every other `/api/agent/*` route. An Agent may address
only its own Triggers. Anchor writability is enforced at `create` and at every
fire; the other verbs require ownership plus continued access to the anchor
message, matching the reminder precedent.

```http
POST   /api/agent/triggers            { title, messageId, kind?, instruction? }
                                      → { trigger, secret, url, curl }
GET    /api/agent/triggers            list
GET    /api/agent/triggers/{id}       show
POST   /api/agent/triggers/{id}/disable
POST   /api/agent/triggers/{id}/enable
POST   /api/agent/triggers/{id}/rotate  → { trigger, secret, url, curl }
DELETE /api/agent/triggers/{id}         → { deleted: true, id }
GET    /api/agent/triggers/{id}/log[?fire=<fireId>][&limit=<1-100>]
```

`kind` defaults to `webhook` and `webhook` is the only accepted value; anything
else is `400 INVALID_ARG` naming the supported kinds. `messageId` is the asking
message the Trigger anchors to, which is what distinguishes Agent authoring from
the operator path.

`anchorMessageId` is `string | null` on every Trigger the wire carries: an
Agent-created Trigger names its asking message, an operator-created one anchors
on the DM alone. A client that builds a link or an excerpt from the anchor must
handle null and fall back to the anchor Chat.

Every response carries the Agent view of the Trigger: the operator fields plus
`anchorTarget`, the Chat target the Trigger is anchored to.

`create` and `rotate` return the bearer secret exactly once; the Server keeps
only its SHA-256 hash, and `list` and `show` never include a secret. `log`
answers one of two tagged shapes and never an empty object:
`{ kind: 'fires', fires }` with payload-free history, newest first, 50 by
default and at most 100, or `{ kind: 'fire', fire }` with one fire and its full
payload when `fire` is supplied.

`url` is derived per request rather than from configuration: the Server has no
public-origin setting and reads `x-forwarded-host` or `host` plus
`x-forwarded-proto` or the connection protocol, so the address is the Server as
seen through the Computer proxy. A reverse proxy must forward both headers with
the externally reachable host and scheme.

Failures use the ordinary Agent API error shape: `401 MISSING_TOKEN` without a
runner credential, `400 INVALID_ARG` for a malformed request, `404
INVALID_TARGET` for a Trigger or anchor the Agent cannot address, `409
TARGET_READ_ONLY` for an archived anchor Chat, and `409 INVALID_ARG` otherwise.

These mutations carry no idempotency key and no expected version. A repeated
call applies again rather than replaying an earlier result.

## Operator procedures

The App uses the Server `trigger` tRPC router on the Agent profile's Automations
tab. Only Server Owners and Admins may call it.

- `trigger.list({ serverId, agentId?, status? })` → Triggers, oldest first
- `trigger.runs({ serverId, triggerId })` → up to 100 fires, newest first, no payloads
- `trigger.create({ serverId, agentId, kind: 'webhook', title, instruction? })` → `{ trigger, secret, url, curl }`
- `trigger.update({ serverId, triggerId, title?, instruction? })` → `{ trigger }`
- `trigger.setStatus({ serverId, triggerId, status: 'armed' | 'disabled' })` → `{ trigger }`
- `trigger.rotate({ serverId, triggerId })` → `{ trigger, secret, url, curl }`
- `trigger.delete({ serverId, triggerId })` → `{ deleted: true, id }`
- `trigger.test({ serverId, triggerId })` → `{ fireId }`

`trigger.create` has no anchor message to take, so it finds or creates the DM
between the calling human and the owning Agent and anchors the Trigger on that
Chat with `anchorMessageId` null; the Agent then answers that Trigger's fires in
that DM. It writes no Chat message — creating a Trigger announces nothing, and
the Trigger's existence is visible on the Automations tab (ADR 0026). It records
the caller in `createdByUserId`, and the Trigger reports `createdByHandle`
alongside it.

`trigger.setStatus` arms and disables in one procedure. It replaces
`trigger.disable`, which no longer exists.

`trigger.update` needs at least one of `title` and `instruction` and touches
nothing else; an `instruction` of null or an empty string clears it, and omitting
it leaves it alone. Every mutation bumps `version`,
which is a change counter rather than an expected-version token — these
procedures carry no idempotency key and no concurrency check, so a repeated call
applies again.

`trigger.test` fires through the same path as the public route: same
transaction, same envelope, and the same per-Trigger rate limiter, so a test
spends real fire budget. It sends
`{"test":true,"sentBy":"<member handle>","sentAt":"<ISO 8601>"}` as
`application/json` with no dedupe key and returns the new `fireId`. It carries no
bearer secret deliberately: an operator who can call `trigger.rotate` can already
fire the Trigger.

`create` and `rotate` are the only procedures that return a secret, and each
returns it once. Every Trigger the router returns carries `url`, so the App can
show the address without ever holding the secret; the URL is derived from the
request, so it is the Server as the App reached it.

Errors follow the router's shared mapping: `FORBIDDEN` below Admin, `NOT_FOUND`
for an unknown Trigger, `CONFLICT` for a disabled or unavailable Trigger, and
`BAD_REQUEST` for a malformed input. There is no durable `trigger.changed` event
and no Trigger subscription, and a fire raises no `message.created` either,
because it writes no message.

## Automation provenance

A fire reaches a conversation only through the Agent's own message. This surface
is shared with reminders; `specs/automation-provenance.md` is the normative
contract.

`POST /api/agent/messages/send` (behind `grotto message send`) accepts an
optional `cause`, the id of the fire the message answers. The Server checks that
the fire exists in this Server, that its automation is owned by the sending
Agent, and, for a Trigger fire, that the Trigger still exists; a failure is
`INVALID_ARG` naming the reason. On success the provenance row is written in the
message's own transaction. A send without `cause` is an ordinary message.

Every message the Server returns carries an optional `cause`
(`packages/grotto-api/src/chat.ts`), joined onto the message so a client renders
provenance from the message alone:

```ts
cause?: {
  kind: 'trigger' | 'reminder';
  automationId: string;
  ownerAgentId: string;   // the owning Agent, for "Manage in Automations"
  fireId: string;
  title: string;
  status: string;
  lastFiredAt: string | null;
  fireCount: number;
  summary: string;          // a reminder's cadence, or a Trigger's kind label
  instruction: string | null; // bounded snippet
}
```

`automation.fireContext({ serverId, messageId })` returns the Thread context for
one caused message. It is authorized by access to the message rather than by
operator role, and answers `NOT_FOUND` when the message has no cause. It returns
the `cause` fields plus, for a Trigger, the `payload` bounded to 8,192
characters, `payloadBytes`, `contentType`, `firedAt`, and the fire's ordinal
among that Trigger's fires; for a reminder, `repeat`, `nextFireAt`,
`anchorMessageId`, and a bounded `anchorExcerpt`. The operator-only
`trigger.runs` is unchanged.

Product logic lives in `apps/server/src/triggers/`. The public route is
`trigger-route.ts` there, the Agent routes are
`apps/server/src/agent-api/trigger-routes.ts`, and the tRPC features are
`apps/server/src/grotto-api/trigger/` and
`apps/server/src/grotto-api/automation/`; the CLI verbs live in
`apps/computer/src/agent-cli/commands/`.
