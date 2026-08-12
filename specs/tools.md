# Tools

Tools are actions available to an Agent through its selected execution runtime or through
Server-owned MCP connections. Tool calls are Computer-local execution evidence. Server may retain a
bounded set of tool names in a turn summary, but not arguments, command contents, model reasoning,
or arbitrary results.

Durable product effects use typed Server APIs such as Messages, Tasks, Reminders, skills, and MCP
invocation. Renderable output becomes a Message visual or Computer-local artifact reference through
an explicit product contract; raw tool protocol fragments do not become Chat rows.
