# Runtime Chats

Runtime chats are conversation surfaces known to a connected runtime.

## Product Expectations

- A runtime chat is a durable conversation surface when the runtime can preserve one.
- A runtime chat corresponds to a recognizable chat, thread, direct conversation, or control
  surface.
- A runtime chat preserves its identity over time.
- A runtime chat can receive messages, hold conversation context, and host scheduled delivery when
  the runtime supports those capabilities.

## Chat State

- A chat has a stable runtime identity.
- A runtime chat does not carry a final Grotto display name. Runtime adapters return stable
  primitive identity, participants, agent bindings, execution references, and typed platform metadata; Grotto
  derives presentation from those facts.
- A chat may have durable conversation history and runtime activity history.
- A chat may have participation rules, such as whether a trigger is required.
- A runtime may expose only chats it has observed.

## Agent Relationship

- A chat does not own agent identity.
- A chat may bind one or more agents intentionally.
- Runtime calls should not rely on a hidden default responder when the runtime supports explicit
  agent targeting.
- Grotto product flows may resolve the primary agent before calling the runtime.
- A chat may expose multiple participating agents when that improves the conversation.

## Trigger And Participation Rules

- A chat may require an explicit trigger before the runtime responds.
- A chat may allow inbound messages to be processed automatically.
- A chat may restrict who is allowed to trigger runtime work.
- Grotto should make it understandable why the runtime responded or ignored a message when the
  runtime reports that information.
