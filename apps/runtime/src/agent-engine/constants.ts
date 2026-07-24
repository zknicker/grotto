// Engine-internal fallback key. No agent is created under this id anymore
// (ADR 0018 — agents are created through the normal create path with
// generated ids); it survives only as the storage key for the engine-level
// default model selection and as the engine's default-agent parameter for
// callers that don't address a specific agent.
export const defaultAgentEngineAgentId = 'agt_primary';

// Fallback display name for engine callers that pass a bare agent id.
export const defaultAgentDisplayName = 'Otto';
