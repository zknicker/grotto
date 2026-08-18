import GrottoModels
import GrottoUI

extension GrottoStore {
    var currentAgentActivityPresentations: [String: AgentActivityPresentation] {
        Dictionary(
            uniqueKeysWithValues: agents.compactMap { agent in
                currentActivityPresentation(agentID: agent.id).map { (agent.id, $0) }
            }
        )
    }

    func currentActivityPresentation(agentID: String) -> AgentActivityPresentation? {
        guard let event = currentActivityByAgentID[agentID],
              agents.first(where: { $0.id == agentID }).map({ availability(for: $0) == .working }) == true
        else { return nil }
        return activityPresentation(event, active: true)
    }

    func agentActivityPresentations(agentID: String) async throws -> [AgentActivityPresentation] {
        try await loadAgentActivityHistory(agentID: agentID)
            .filter { $0.phase != .started }
            .prefix(16)
            .map { activityPresentation($0, active: false) }
    }

    private func activityPresentation(
        _ event: AgentActivityEvent,
        active: Bool
    ) -> AgentActivityPresentation {
        let state: AgentActivityState = active
            ? .active
            : event.phase == .failed ? .failed : .completed
        return AgentActivityPresentation(
            id: event.id,
            title: active ? event.category.activeTitle : event.category.completedTitle,
            occurredAt: event.occurredAt,
            state: state
        )
    }
}

private extension AgentActivityCategory {
    var activeTitle: String {
        switch self {
        case .startingWork: "Starting work…"
        case .checkingMessages: "Checking messages…"
        case .thinking: "Thinking…"
        case .browsing: "Browsing…"
        case .searchingWeb: "Searching the web…"
        case .readingFiles: "Reading files…"
        case .editingFiles: "Editing files…"
        case .runningCommand: "Running a command…"
        case .usingTool: "Using a tool…"
        case .sendingMessage: "Finishing up…"
        case .working: "Working…"
        }
    }

    var completedTitle: String {
        switch self {
        case .startingWork: "Started work"
        case .checkingMessages: "Checked messages"
        case .thinking: "Finished thinking"
        case .browsing: "Finished browsing"
        case .searchingWeb: "Searched the web"
        case .readingFiles: "Read files"
        case .editingFiles: "Edited files"
        case .runningCommand: "Ran a command"
        case .usingTool: "Used a tool"
        case .sendingMessage: "Sent a message"
        case .working: "Finished work"
        }
    }
}
