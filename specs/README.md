# Specs

This tree contains normative Grotto product contracts. Grotto Server owns shared collaboration
state and authorization. Grotto Computer owns machine-local Agent execution. Grotto App consumes
Server contracts and does not connect directly to Computer.

Write specs in present tense, use the nouns in `CONTEXT.md`, and remove superseded designs instead
of preserving them as live alternatives. Cross-boundary first-party types belong in
`packages/tavern-api`.

Core contracts cover agents, chats, messages, threads, tasks, reminders, identity, permissions,
skills, tools, MCP connections, execution configuration, and Computer release/update behavior.
Use `bun run docs:list` for routed documentation and `docs/adr/` for durable architectural
decisions.
