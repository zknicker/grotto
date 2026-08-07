# Messages

Messages are Grotto's normal conversational interactions.

## Product Expectations

- A message is the primitive for normal assistant and participant output in chats and sessions.
- A message is not a tool interaction, worker, or generic system event.
- Messages feel consistent across chats and sessions.

## Identity And Content

- A message has stable identity, timestamp, author, and text.
- A message preserves who said it and when.
- A message may carry model and provider metadata when Grotto has it.
- A user-authored message may include explicit rich-reference markdown links.
- Capability references do not make a message a tool interaction and do not grant tool access.

## Relationships

- A message belongs to a chat, a session, or both.
- A message is authored by an agent or a participant.
- A message may lead into a related tool interaction.

## Presentation

- Messages render from server-owned normalized rows.
- The product does not require React to infer authorship or model identity from raw runtime
  payloads.
- Rich references render as message fragments when the durable message content includes explicit
  typed markdown links such as `[@Grotto](agent://agt_primary)` or
  `[$ui](skill://ui)`.
- Grotto parses message content to find rich references. Message metadata is not the source of
  truth for mention identity.
- Unrecognized links and bare mention-looking text render as normal text or markdown.
- Grotto may project referenced, assigned skills into the execution-only prompt as a compact
  activation hint. Capability and path references stay as visible markdown. This does not change
  durable message text and does not grant access to tools or skills that the runtime would not
  otherwise expose.
