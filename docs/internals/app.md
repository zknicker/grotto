---
summary: Grotto App ownership, hosted data flow, cache boundaries, and Electron shell responsibilities.
read_when:
  - changing App data flow, routing, caching, settings, or Electron behavior
  - deciding whether behavior belongs in App or Server
---

# Grotto App

Grotto App is the React client in `apps/website`. It talks to Grotto Server through the hosted tRPC
client and renders Server-owned collaboration state. The same App runs in a browser or in Electron;
Electron owns desktop installation, window behavior (the menu bar and its shortcuts, window-state
persistence, focus dimming, history swipes, and the Dock unread badge), and desktop updates, not a
local backend.

The App owns presentation state, local preferences, React Query cache state, optimistic compose
rows, routing, and transient UI. Server owns durable Chats, Messages, Tasks, members, Agents,
attachments, and Computer reports. Optimistic rows remain App-local until Server acknowledges the
mutation.

Computer availability is displayed from Server-reported state. The App does not probe local
processes, construct execution routing ids, connect to Computer, or keep a second canonical
timeline. A Computer being offline degrades execution controls without hiding already-synced Server
data.

## Session Refresh And Reconnect

The App keeps one tRPC client and React provider mounted for the signed-in human. Clerk token
rotation reconnects only that client's websocket; the reconnect reads fresh connection parameters
and resumes pending subscriptions. Credential rotation must not replace the tRPC provider, remount
the Server shell, clear composer drafts, or discard other local presentation state.

A genuine human identity change renders through a newly keyed hosted QueryClient and provider so
the next identity cannot observe the previous identity's cache or local presentation state. After a
websocket reconnect, active durable queries reconcile from Server state while their cached snapshot
continues rendering.

React ownership and event rules live in [React Conventions](react.md).
