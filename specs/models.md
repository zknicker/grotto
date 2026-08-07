# Models

Models are Grotto's product surface for choosing how agents execute. Runtime owns the provider
catalog, enabled model providers, provider access, model records, agent default models, and Agent
session effective models.

## Product Expectations

- Grotto presents model setup in product language, not as raw provider dumps.
- Users choose which providers are enabled for their Runtime.
- Grotto does not pollute agent model pickers with every provider Grotto knows how to support.
- Settings exposes recovery paths for missing credentials, missing CLI OAuth state, and invalid
  model selections.
- Users do not edit Runtime config files to inspect, add, or select supported model settings.

## Terms

| Term | Contract |
| --- | --- |
| Provider catalog | Maintained Runtime list of model providers Grotto can add. |
| Enabled model provider | Provider the user has added to this Runtime. |
| Provider access | Credential and host setup state for an enabled provider. |
| Executable provider | Enabled provider whose access is ready on the Runtime host. |
| Model record | Catalog row for one concrete model route. |
| Executable model | Model record that belongs to an executable provider. |
| Agent default model | Agent profile model used when Runtime creates a new Agent session. |
| Effective model | Model an existing Agent session currently uses. |

## Ownership

- **Runtime owns provider state.** Runtime stores enabled providers, provider access state, provider
  credentials, model records, agent default models, and Agent session effective models.
- **App renders and edits Runtime state.** Grotto App does not keep a competing provider registry,
  selected-model store, or provider-specific execution config.
- **Server proxies Runtime contracts.** Grotto Server may cache Runtime reads for presentation, but
  Runtime remains canonical for execution.
- **Provider credentials stay Runtime-owned.** API keys are saved in Runtime secret storage.
  OAuth-backed CLI providers use Runtime-host credentials or Runtime-stored tokens when supported.

## Provider Lifecycle

Providers move through explicit product states:

| State | Meaning | User action |
| --- | --- | --- |
| Addable | Provider exists in the provider catalog but is not enabled for this Runtime. | Add provider. |
| Enabled, needs access | Provider is enabled but cannot execute yet. | Add API key, complete OAuth, or run host setup command. |
| Executable | Provider is enabled and access checks pass on the Runtime host. | Select models and run agents. |
| Degraded | Provider was executable but current access check fails. | Repair credentials or host setup. |
| Disabled | Provider is enabled but intentionally unavailable for execution. | Re-enable or remove. |

Adding a provider creates an enabled-provider record. It does not require access to succeed in the
same step. This lets users add Claude Code and then run its sign-in, or add OpenAI and then
paste an API key.

Removing a provider removes it from the executable catalog and hides its models from pickers.
Removal does not erase saved credentials or host OAuth state; re-adding the provider may reuse live
access. Runtime must protect active Agent sessions and saved Agent defaults that reference removed
providers by surfacing an invalid selection state before execution.

## Provider Setup

Provider setup is provider-specific but has one product shape:

- **API-key providers.** The Add provider dialog asks for the key. Runtime stores the secret and
  marks the provider executable after validation.
- **External OAuth CLI providers.** The dialog enables the provider and shows a copyable command to
  run on the Runtime host, such as a Codex login command. Runtime marks the provider executable
  only after host access is observable.
- **Runtime-managed OAuth providers.** The dialog starts the OAuth flow through Runtime — Claude
  Code uses the code-paste sign-in from [model-access.md](model-access.md) — and resolves as
  approved, denied, expired, or errored.
- **Local endpoint providers.** The dialog collects endpoint configuration and optional key material.
  Runtime marks the provider executable after it can construct the model route.

The setup dialog can show provider-specific instructions, but the product action remains "Add
provider".

## Catalogs And Inventories

Grotto separates three model lists:

| List | Contents | Used by |
| --- | --- | --- |
| Provider catalog | Every provider Grotto can add. | Add provider dropdown. |
| Enabled provider inventory | Providers this Runtime has enabled, with access state. | Settings -> Models provider rows. |
| Executable model inventory | Model records under executable providers. | Agent model pickers and defaulting. |

Curated model rows are authored model inventory, not hidden fallback behavior. Live provider model
APIs may enrich or validate rows for providers whose inventory changes by design, such as
aggregators.

The agent model picker lists executable models by default. It may also show an unavailable saved
selection in-place so the user can repair it without silently changing the agent.

## Defaulting And Repair

Runtime uses one defaulting strategy. Runtime Doctor applies this policy at startup and after model
provider/access changes; turn execution only guards against stale or racy state.

1. If an Agent has a saved default model that is valid and executable, use it.
2. If the saved default model is invalid or unavailable, repair to the highest-ranked executable
   model.
3. If no executable model exists, leave the Agent unresolved and surface provider setup.
4. If the Agent has no saved default model, set it to the highest-ranked executable model.

"Highest-ranked executable model" is a Runtime-maintained policy, not an app heuristic. The first
ranked provider for the local Grotto product is Codex, followed by Claude Code, then OpenAI API.
Runtime may adjust ranking as the provider catalog evolves.

Agent default models are recoverable preferences. If a saved default cannot execute and another
model can, Runtime repairs the Agent default rather than preserving a broken preference.

See [Runtime Doctor](../docs/internals/runtime-doctor.md) for the modular repair runner.

## Capabilities

Provider catalog and setup reads are not Runtime capabilities. If the Runtime API is reachable,
Settings -> Models can load setup state and repair controls.

Execution readiness is a Runtime capability. The capability answers whether at least one agent
execution path has a usable effective model now. Chat send, scheduled work, and other agent-run
actions gate on execution readiness. Settings and provider setup pages gate only on Runtime API
reachability.

Provider health belongs on provider rows. A missing OpenAI key, missing Claude Code login, or missing
Codex auth file is provider access state, not global app readiness.

## UI Contract

`Settings -> Models` has three jobs:

- Show enabled providers and their access state.
- Let users add providers from the provider catalog.
- Let users remove enabled providers so their models no longer appear as executable options.
- Let users configure or replace an API key for an enabled API-key provider without removing it.
- Show executable models produced by enabled executable providers.

The Add provider control opens a searchable provider catalog. Selecting a provider opens the setup
flow for that provider:

- API-key provider: secret input dialog.
- External OAuth CLI provider: copyable host command and refresh action.
- Runtime-managed OAuth provider: browser/device-code flow.
- Local endpoint provider: endpoint and optional key fields.

Agent settings use executable model inventory for normal selection. If the current saved model is
invalid or unavailable, the picker keeps the current value visible with a repair state instead of
silently hiding it.

## API Shape

Runtime exposes separate contracts for:

- provider catalog list
- enabled provider list
- add provider
- remove provider
- save provider access
- start/poll/submit/cancel provider OAuth
- model inventory for executable providers
- agent default model read/update
- Agent session effective model read/update

`/models` is the executable model inventory for model selection and execution. Add-provider metadata
belongs to provider catalog and provider access routes, not mixed into executable model rows.
