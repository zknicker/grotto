import SwiftUI

/// Read-only details for the currently selected Chat.
///
/// This is deliberately a presentation of the existing Chat and Server
/// snapshots. It does not create a second participant or chat configuration
/// model on the device.
public struct ChatDetailsView: View {
    @Environment(\.dismiss) private var dismiss

    private let chat: ChatDestination
    private let server: ServerPresentation
    private let currentActivity: AgentActivityPresentation?
    private let loadAgentActivity: @Sendable (String) async throws -> [AgentActivityPresentation]
    private let onOpenAgentProfile: (String) -> Void
    @State private var historyState = ActivityHistoryState.idle

    /// - Parameter onOpenAgentProfile: hands the Agent id to the shell, which
    ///   dismisses this sheet and opens Settings on that Agent's profile.
    public init(
        chat: ChatDestination,
        server: ServerPresentation,
        currentActivity: AgentActivityPresentation? = nil,
        loadAgentActivity: @escaping @Sendable (String) async throws -> [AgentActivityPresentation] = { _ in [] },
        onOpenAgentProfile: @escaping (String) -> Void = { _ in }
    ) {
        self.chat = chat
        self.server = server
        self.currentActivity = currentActivity
        self.loadAgentActivity = loadAgentActivity
        self.onOpenAgentProfile = onOpenAgentProfile
    }

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    hero
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                if case .agentDirectMessage(let agent) = chat.kind {
                    activitySections(agent: agent)
                }
            }
#if os(iOS)
            .listStyle(.insetGrouped)
#else
            .listStyle(.inset)
#endif
            .navigationTitle("")
            .grottoInlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
        .task(id: agentID) { await loadHistory() }
    }

    @ViewBuilder
    private func activitySections(agent: AgentPresentation) -> some View {
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

        Section {
            Button { onOpenAgentProfile(agent.id) } label: {
                HStack(spacing: 12) {
                    Label("View profile", systemImage: "person.crop.circle")
                        .foregroundStyle(.primary)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.tertiary)
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View \(agent.name)'s profile")
        }
    }

    private var agentID: String? {
        guard case .agentDirectMessage(let agent) = chat.kind else { return nil }
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

    private var hero: some View {
        VStack(spacing: 12) {
            chatIdentity

            VStack(spacing: 4) {
                Text(chat.title)
                    .font(.title2.weight(.semibold))
                statusLine
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var statusLine: some View {
        switch chat.kind {
        case .channel:
            Text("Channel · \(server.name)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        case .agentDirectMessage(let agent):
            HStack(spacing: 6) {
                Circle()
                    .fill(agent.presence.activityColor)
                    .frame(width: 8, height: 8)
                Text(currentActivity?.title ?? agent.presence.title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if currentActivity != nil {
                    ProgressView().controlSize(.mini)
                }
            }
        case .humanDirectMessage(let human):
            Text(human.handle.map { "Human · @\($0)" } ?? "Human")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var chatIdentity: some View {
        switch chat.kind {
        case .channel:
            // The hero sits where a DM's circular Agent avatar sits, so it keeps
            // the circle and only takes the channel's glyph and tint.
            ChannelIconBox(appearance: chat.appearance, size: 72, glyphSize: 32, shape: .circle)
        case .agentDirectMessage(let agent):
            AvatarView(
                name: agent.name,
                url: agent.avatarURL,
                presence: agent.presence,
                size: 72
            )
        case .humanDirectMessage(let human):
            AvatarView(name: human.name, url: human.avatarURL, presence: nil, size: 72)
        }
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
        chat: .durableChat(ChatFixtures.chats[1]),
        server: ChatFixtures.server
    )
}

#Preview("Agent details") {
    ChatDetailsView(
        chat: .durableChat(ChatFixtures.chats[3]),
        server: ChatFixtures.server
    )
}
