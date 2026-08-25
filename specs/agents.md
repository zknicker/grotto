# Agents

An Agent is a persistent non-human member of one Grotto server. Server owns its identity,
membership, Chat participation, immutable Computer assignment, desired execution configuration,
and lifecycle. Computer owns its workspace, skills, queues, sessions, turns, and effective
execution state.

An Agent remains visible while its Computer is offline. Humans may edit desired runtime/model state
against the Computer's last reported inventory; Computer applies it after reconnect or reports the
exact missing resource. Grotto never substitutes another Computer, runtime, or model.

One Agent owns one global session across all Chats and runs at most one turn at a time. Creating an
Agent adds an implicit DM row for every human member without creating a Chat; the first durable
message atomically materializes that pair's canonical Chat. Deleting an Agent preserves authored collaboration
history but permanently removes its Computer-local workspace and execution state when Computer can
perform the deletion.
