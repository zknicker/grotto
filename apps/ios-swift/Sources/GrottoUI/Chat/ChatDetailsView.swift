import SwiftUI

/// Read-only details for the currently selected Chat.
///
/// This is deliberately a presentation of the existing Chat and Server
/// snapshots. It does not create a second participant or chat configuration
/// model on the device.
public struct ChatDetailsView: View {
    @Environment(\.dismiss) private var dismiss

    private let chat: ChatPresentation
    private let server: ServerPresentation
    private let isConnected: Bool
    private let currentActivity: AgentActivityPresentation?
    private let loadAgentActivity: @Sendable (String) async throws -> [AgentActivityPresentation]
    @State private var historyState = ActivityHistoryState.idle

    public init(
        chat: ChatPresentation,
        server: ServerPresentation,
        isConnected: Bool,
        currentActivity: AgentActivityPresentation? = nil,
        loadAgentActivity: @escaping @Sendable (String) async throws -> [AgentActivityPresentation] = { _ in [] }
    ) {
        self.chat = chat
        self.server = server
        self.isConnected = isConnected
        self.currentActivity = currentActivity
        self.loadAgentActivity = loadAgentActivity
    }

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    identityRow
                }

                if case .directMessage(let agent) = chat.kind {
                    activitySections(agent: agent)
                }

                Section("Chat") {
                    detailRow(
                        title: "Server",
                        value: server.name,
                        systemImage: "server.rack"
                    )
                    detailRow(
                        title: "Connection",
                        value: isConnected ? "Connected" : "Offline",
                        systemImage: isConnected ? "checkmark.circle" : "wifi.slash"
                    )
                    detailRow(
                        title: "Unread",
                        value: chat.unreadCount == 0 ? "None" : "\(chat.unreadCount)",
                        systemImage: "circle.fill"
                    )
                }

            }
#if os(iOS)
            .listStyle(.insetGrouped)
#else
            .listStyle(.inset)
#endif
            .navigationTitle(navigationTitle)
            .grottoInlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .tint(.blue)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
        .task(id: agentID) { await loadHistory() }
    }

    private var navigationTitle: String {
        switch chat.kind {
        case .channel: "Chat details"
        case .directMessage: "Agent activity"
        }
    }

    @ViewBuilder
    private func activitySections(agent: AgentPresentation) -> some View {
        Section("Now") {
            HStack(spacing: 12) {
                Circle()
                    .fill(agent.presence.activityColor)
                    .frame(width: 10, height: 10)
                Text(currentActivity?.title ?? agent.presence.title)
                Spacer(minLength: 12)
                if currentActivity != nil {
                    ProgressView().controlSize(.small)
                }
            }
            .accessibilityElement(children: .combine)
        }

        Section("Recent activity") {
            switch historyState {
            case .idle, .loading:
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
            case .failed:
                ContentUnavailableView(
                    "Activity unavailable",
                    systemImage: "clock.badge.exclamationmark"
                )
            case .loaded(let events) where events.isEmpty:
                Text("No recent activity")
                    .foregroundStyle(.secondary)
            case .loaded(let events):
                ForEach(events) { event in
                    HStack(spacing: 12) {
                        Image(systemName: event.state.systemImage)
                            .foregroundStyle(event.state.color)
                            .frame(width: 22)
                        Text(event.title)
                        Spacer(minLength: 8)
                        Text(
                            event.occurredAt,
                            format: .relative(presentation: .numeric, unitsStyle: .abbreviated)
                        )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    private var agentID: String? {
        guard case .directMessage(let agent) = chat.kind else { return nil }
        return agent.id
    }

    private func loadHistory() async {
        guard let agentID else { return }
        historyState = .loading
        do {
            historyState = .loaded(try await loadAgentActivity(agentID))
        } catch is CancellationError {
            return
        } catch {
            historyState = .failed
        }
    }

    private var identityRow: some View {
        HStack(spacing: 14) {
            chatIdentity

            VStack(alignment: .leading, spacing: 2) {
                Text(chat.title)
                    .font(.headline)
                Text(chat.kind.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private var chatIdentity: some View {
        switch chat.kind {
        case .channel:
            Image(systemName: "number")
                .font(.title2.weight(.medium))
                .frame(width: 42, height: 42)
                .background(.quaternary, in: .circle)
                .accessibilityHidden(true)
        case .directMessage(let agent):
            AvatarView(
                name: agent.name,
                url: agent.avatarURL,
                presence: agent.presence,
                size: 42
            )
        }
    }

    private func detailRow(
        title: String,
        value: String,
        systemImage: String
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(.secondary)
                .frame(width: 22)
            Text(title)
            Spacer(minLength: 12)
            Text(value)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

private enum ActivityHistoryState {
    case idle
    case loading
    case loaded([AgentActivityPresentation])
    case failed
}

private extension AgentActivityState {
    var systemImage: String {
        switch self {
        case .active: "circle.fill"
        case .completed: "checkmark.circle"
        case .failed: "exclamationmark.circle"
        }
    }

    var color: Color {
        switch self {
        case .active: .yellow
        case .completed: .green
        case .failed: .gray
        }
    }
}

private extension ChatKind {
    var subtitle: String {
        switch self {
        case .channel:
            "Channel"
        case .directMessage(let agent):
            "Direct message with \(agent.name)"
        }
    }
}

private extension AgentPresence {
    var activityColor: Color {
        switch self {
        case .idle: .green
        case .working: .yellow
        case .error, .offline, .stopped: .gray
        }
    }

    var title: String {
        switch self {
        case .idle: "Online"
        case .working: "Working"
        case .error: "Error"
        case .offline: "Offline"
        case .stopped: "Stopped"
        }
    }
}

#Preview("Channel details") {
    ChatDetailsView(
        chat: ChatFixtures.chats[1],
        server: ChatFixtures.server,
        isConnected: true
    )
}

#Preview("Agent details") {
    ChatDetailsView(
        chat: ChatFixtures.chats[3],
        server: ChatFixtures.server,
        isConnected: false
    )
}
