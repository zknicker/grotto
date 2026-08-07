# Identity And Membership

Grotto users are real authenticated humans. Clerk is the identity provider;
Grotto mints its own user ids and keys everything on those. One Runtime is
owned by one user and serves that owner plus invited members. This is
greenfield: no adoption or migration flows exist — a runtime without an owner
is simply unclaimed.

## Product boundary

- A `user` is one authenticated human with a stable `tavern user id`.
  Clerk's user id is a unique external reference on the user record, never a
  key anywhere else. Profile fields (name, avatar, email) are refreshable
  snapshots from Clerk, never identity.
- The Runtime is the tenant. There is no separate workspace/tenant record in
  v1: membership, chats, agents, and settings all belong to the runtime.
- A `member` is one user's standing on a runtime: role `owner` or `member`.
  Exactly one owner exists. The explicit bind is `tavern claim --clerk-key
  <key> --user <clerk-user-id>` run on the runtime host — it configures
  Clerk verification and records the owner in one step; the app's
  connect-runtime page generates this command for the signed-in user. As a
  convenience, a runtime that already has a Clerk key configured is also
  claimed by the first verified user to connect. Ownership never transfers;
  resetting means deleting the runtime database (greenfield).
- Agents, model credentials, MCP connections, skills, secrets, and runtime
  settings are owner-administered. Members converse; the owner runs the house.

## Ownership vs access

Single-owner does not mean single-user. The owner administers the runtime and
supplies the compute and model credentials agents run on. Members are
authenticated clients of that runtime: they join chats, talk to agents, and
read shared history. Agent execution always runs under the owner's runtime,
never under a member's credentials.

## Authentication

- Grotto App requires sign-in. With no locally cached identity the app shows
  only the sign-in gate.
- The App attaches the Clerk session token to every server and Runtime
  request. Runtime verifies tokens against Clerk's JWKS (cached), resolves
  `clerk_user_id` to a user get-or-create, and rejects non-members.
- Offline or Clerk-unreachable: the app renders local synced data on the
  cached identity and re-verifies opportunistically. Forced re-auth happens
  only on explicit sign-out or after 14 days without a successful
  verification.
- Sign-out detaches the app surface only. Runtime work (turns, automations,
  cron) continues; it belongs to the runtime, not the session.
- Keyless dev builds (`VITE_CLERK_PUBLISHABLE_KEY` absent) run a signed-out
  dev mode with no gate; e2e and the mock runtime use this path. Packaged
  builds bake the production publishable key and always gate.

## Membership flow

- The owner creates invites (single-use code or link) from settings.
- A user signs in with Clerk, redeems an invite against the runtime, and
  becomes a `member`. A signed-in non-member sees an invite-entry gate
  instead of the app.
- The owner can revoke membership; revocation closes that user's access
  immediately. Their authored history remains.
- The runtime token remains the owner's transport/bootstrap credential and
  the escape hatch for headless administration. Members never hold it.

## Data keying

- Human authorship: messages, reads, receipts, reactions, and app
  preferences key on `tavern user id`. A user's tavern id is their chat
  participant id (`usr_…`). The server stamps the acting user resolved from
  the request's Clerk session token.
- Keyless dev/e2e builds act as the synthetic local operator `usr_tavern`;
  that id is the fallback only when sign-in is disabled, never a real user.
- Owner-scoped surfaces keep single-operator actors for now: session
  evidence views (`profile:self`), task work-order seeding, and
  channel-relay ingress. They key per-user when those surfaces gain
  member-facing semantics.
- Externally observed identities (Discord, iMessage, …) remain
  `participants` per [participants.md](participants.md). A member is not a
  participant; no automatic linking between members and observed identities.
- Read state is per user per chat. Channel membership is all members by
  default; DMs are visible to their human participants only. This is
  UI/API-level scoping, not encryption — the owner physically holds the
  database and members must expect that.

## Non-goals (v1)

- Multiple owners or ownership transfer.
- Multiple workspaces per runtime, or one user spanning runtimes with merged
  state.
- Member-supplied compute or model credentials (Raft-style "bring your own
  agent" is a possible later layer).
- Per-member agent permissioning beyond chat participation.

## Open questions

- Presence and typing indicators for multiple humans in one channel.
- Whether members may start new channels/DMs with agents or only join
  existing ones.
- Billing/spend visibility when members drive owner-credentialed agents.
