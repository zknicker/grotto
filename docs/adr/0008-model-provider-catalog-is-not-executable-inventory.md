---
summary: Decision to separate addable model providers from enabled providers, provider access, and executable model inventory.
read_when:
  - changing model provider setup, add-provider flows, model inventory, or Agent model defaulting
  - changing Runtime model capabilities or model access contracts
---

# ADR 0008: Model Provider Catalog Is Not Executable Inventory

## Status

Accepted.

## Context

Grotto separates the maintained provider catalog from the Runtime's enabled providers and executable
models. The provider catalog lists what Grotto can add; enabled providers are the user's Runtime
choices; executable models are the model records available for agent turns after provider access is
ready. This keeps Settings -> Models useful for setup without polluting agent model pickers with
every provider Grotto may support.

## Decision

Runtime exposes a provider catalog for add-provider flows, an enabled provider list for configured
user choices, provider access state for credentials and host setup, and `/models` for executable
model inventory.

Agent defaulting uses executable model inventory only. If a saved model is invalid, unavailable, or
unset, Runtime repairs or sets it to the highest-ranked executable model. If no executable model
exists, the app remains navigable and prompts provider setup.
