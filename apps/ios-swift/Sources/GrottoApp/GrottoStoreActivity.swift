import Foundation
import GrottoModels

extension GrottoStore {
    func loadAgentActivityHistory(agentID: String) async throws -> [AgentActivityEvent] {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.serverUnavailable
        }
        let page: AgentActivityHistoryPage = try await client.query(
            "agent.activityHistory",
            input: AgentActivityHistoryInput(agentId: agentID, serverId: serverID)
        )
        return page.events
    }

    func reloadActiveActivity(serverID: String) async {
        guard activeServer?.id == serverID else { return }
        do {
            let snapshot: AgentActiveActivitySnapshot = try await client.query(
                "agent.activeActivity",
                input: ServerScopedInput(serverId: serverID)
            )
            guard activeServer?.id == serverID else { return }
            replaceActiveActivitySnapshot(snapshot)
        } catch is CancellationError {
            return
        } catch {
            // Lifecycle availability remains authoritative for the dot. A
            // transient semantic-activity failure must not make an Agent idle.
        }
    }

    func replaceActiveActivitySnapshot(_ snapshot: AgentActiveActivitySnapshot) {
        let workingAgentIDs = Set(
            agents.filter { availability(for: $0) == .working }.map(\.id)
        )
        currentActivityByAgentID = Dictionary(
            uniqueKeysWithValues: snapshot.activities.compactMap { event in
                guard workingAgentIDs.contains(event.agentID),
                      event.phase == .started || event.isFinishing
                else { return nil }
                return (event.agentID, event)
            }
        )
        currentActivityPositionByRunID = Dictionary(
            uniqueKeysWithValues: snapshot.activities.map { ($0.runID, $0.position) }
        )
    }

    func handle(activityEvent event: AgentActivityEvent) {
        guard event.serverID == activeServer?.id else { return }
        let latestPosition = currentActivityPositionByRunID[event.runID] ?? 0
        guard event.position > latestPosition else { return }
        currentActivityPositionByRunID[event.runID] = event.position

        let current = currentActivityByAgentID[event.agentID]
        if current?.runID == event.runID, event.isTerminal {
            // Canonical lifecycle settlement removes the row and yellow dot
            // together. Preserve the last useful semantic label until then.
            return
        }
        if current?.runID == event.runID,
           current?.isFinishing == true,
           event.phase != .started {
            return
        }
        if event.phase == .started || event.isFinishing {
            currentActivityByAgentID[event.agentID] = event
        } else if current?.runID == event.runID {
            currentActivityByAgentID[event.agentID] = event.projectedAsWorking()
        }
    }
}
