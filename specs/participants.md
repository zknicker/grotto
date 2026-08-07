# Participants

Grotto stores runtime-observed participants as source provenance. The app does not ask users to
manage an identity directory or reconcile external accounts.

This keeps provider details available for audit and routing while avoiding fragile automatic merges
across Discord, Slack, iMessage, Telegram, or local agent executors.

## Model

- The self actor may use `profile:self` for Grotto-authored local messages.
- A `participant` is one observed source identity from one runtime/provider/account/external id.
- A participant is not "self" and does not carry an `is_self` flag.
- A `participant label` is an observed display label for that participant.
- Grotto does not expose a Profile settings page or an Observed Identities linking workflow.

## Tables

- `participants`: observed provider identity with `provider`, `account_key`, `external_id`, and
  current observed name.
- `participant_labels`: observed labels for one participant.

Runtime ingestion owns participant observation. App settings do not own participant identity.

## Identity Rules

- Same provider/account/external id resolves to the same participant.
- Different providers do not automatically resolve to the same person.
- Same display names do not automatically resolve to the same person.
- Display names are labels, not identity.
- Grotto does not ask users to reconcile observed source identities.

Grotto renders a participant using its best observed label while preserving the participant id as
provenance.

## Runtime Mapping

The Runtime adapter normalizes provider-native data before Grotto stores it.

Examples:

| Runtime fact | Grotto participant |
| --- | --- |
| Discord user id `778786269458464829` | `provider=discord`, `external_id=778786269458464829` |
| Telegram user id `123456` | `provider=telegram`, `external_id=123456` |
| iMessage address `+15551234567` | `provider=imessage`, `external_id=+15551234567` |

Provider-specific parsing belongs in the runtime adapter package. Grotto Runtime API receives
normalized participants and labels.

## Rendering

- Chat, message, and participant surfaces render participants from observed source labels.
- Rendering should not rewrite stored message actor ids. Messages authored by an observed
  participant point at that participant.
- Grotto self-authored local messages may use `actor.kind=profile` with `id=profile:self`.

## Non-Goals

- No automatic cross-provider person merge.
- No `is_self` on participants.
- No Profile settings page.
- No Observed Identities settings page.
- No manual observed-identity linking workflow.
- No provider-specific fields leaking into frontend display logic except as explicit provenance.
