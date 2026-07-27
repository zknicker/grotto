---
summary: Fresh-install and destructive-cutover procedure for the hosted Grotto Server and attached Grotto Computers.
read_when:
  - preparing the first hosted Grotto release
  - cutting over from a pre-hosted Tavern installation
---

# Fresh Hosted Cutover

WS6 is a clean break. Do not migrate local SQLite state, App cache, Runtime
state, Agent workspaces, credentials, or old desktop-sidecar configuration.

1. Back up any information the operator wants to keep outside Grotto. The
   product does not import it.
2. Stop and uninstall the old local Runtime/Desktop deployment. Remove its
   local SQLite and App-cache state only after confirming the external backup.
3. Bootstrap a new hosted Grotto Server PostgreSQL database and attachment
   root following [Grotto Server deploy](grotto-server-deploy.md).
4. Install the current App. It connects directly to the hosted Server; it does
   not start a local backend or create a canonical local database.
5. Create the Server and first Owner in the App, then install and attach
   `grotto-computer` with `grotto-computer setup /<server-slug>`.
6. Create Agents against that attached Computer, configure their local model
   credentials, and import only skills intentionally wanted in the new Agent
   libraries.
7. Verify one human chat, one Agent response, and a reconnect in the
   deterministic hosted test lane before admitting production users.

This is destructive. There is no rollback into the retired topology, no
automatic workspace adoption, and no compatibility endpoint for an old App.
An App with a different `appProtocolVersion` must be updated before the Server
serves any product request or subscription.
