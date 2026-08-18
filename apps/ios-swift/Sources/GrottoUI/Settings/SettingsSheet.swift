import SwiftUI
import GrottoModels

public enum SettingsRoute: Hashable {
    case profile
    case agent(id: String)
    case server
    case tasks
    case people
    case computers
    case appInfo
    case description(ownerID: String, title: String, value: String)
}

public enum AppearancePreference: String, CaseIterable, Hashable, Sendable {
    case system
    case light
    case dark

    public var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }
}

public struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    private let persistence: SettingsPersistence
    private let tasksPersistence: TaskListPersistence?
    private let onOpenTask: (TaskListItem) -> Void
    @State private var data: SettingsData
    @State private var path: [SettingsRoute] = []
    @Binding private var appearance: AppearancePreference

    public init(
        data: SettingsData = SettingsFixtures.data,
        persistence: SettingsPersistence = .preview,
        appearance: Binding<AppearancePreference> = .constant(.system),
        tasksPersistence: TaskListPersistence? = nil,
        onOpenTask: @escaping (TaskListItem) -> Void = { _ in }
    ) {
        self.persistence = persistence
        self.tasksPersistence = tasksPersistence
        self.onOpenTask = onOpenTask
        _data = State(initialValue: data)
        _appearance = appearance
    }

    public var body: some View {
        NavigationStack(path: $path) {
            SettingsHubView(
                data: data,
                appearance: $appearance,
                onNavigate: { path.append($0) }
            )
            .navigationTitle("Settings")
            .grottoInlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .automatic) {
                    GlassChromeButton(action: { dismiss() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 17, weight: .medium))
                    }
                    .padding(.trailing, 4)
                    .accessibilityLabel("Close settings")
                }
            }
            .navigationDestination(for: SettingsRoute.self) { route in
                destination(for: route)
            }
        }
        .tint(.blue)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
    }

    @ViewBuilder
    private func destination(for route: SettingsRoute) -> some View {
        switch route {
        case .profile:
            HumanProfileView(
                person: data.viewer,
                onEditDescription: { ownerID, title, value in
                    path.append(.description(ownerID: ownerID, title: title, value: value))
                },
                onSave: { updated in
                    let saved = try await persistence.saveHumanProfile(
                        updated.id,
                        updated.displayName,
                        updated.description
                    )
                    updateViewer(saved)
                    return saved
                },
                onSaveAvatar: { payload in
                    let saved = try await persistence.saveHumanAvatar(data.viewer.id, payload)
                    await MainActor.run {
                        updateViewer(saved)
                    }
                }
            )
        case .agent(let id):
            if let agent = data.agents.first(where: { $0.id == id }) {
                AgentProfileView(
                    agent: agent,
                    onEditDescription: { ownerID, title, value in
                        path.append(.description(ownerID: ownerID, title: title, value: value))
                    },
                    onSave: { updated in
                        let saved = try await persistence.saveAgentProfile(
                            updated.id,
                            updated.displayName,
                            updated.description
                        )
                        updateAgent(saved)
                        return saved
                    },
                    onSaveAvatar: { payload in
                        let saved = try await persistence.saveAgentAvatar(agent.id, payload)
                        await MainActor.run {
                            updateAgent(saved)
                        }
                    }
                )
            } else {
                SettingsUnavailableView(title: "Agent profile")
            }
        case .server:
            ServerDetailsView(
                server: data.server,
                onOpenTasks: { path.append(.tasks) }
            )
        case .tasks:
            if let tasksPersistence {
                TaskListDestinationView(
                    persistence: tasksPersistence,
                    onOpenTask: { item in
                        dismiss()
                        onOpenTask(item)
                    }
                )
            } else {
                SettingsUnavailableView(title: "Tasks")
            }
        case .people:
            ServerPeopleView(members: data.members)
        case .computers:
            ServerComputersView(computers: data.computers)
        case .appInfo:
            AppInfoView()
        case .description(let ownerID, let title, let value):
            DescriptionEditorView(
                title: title,
                value: value,
                onSave: { updatedValue in
                    try await saveDescription(ownerID: ownerID, value: updatedValue)
                    path.removeLast()
                }
            )
        }
    }

    private func updateViewer(_ viewer: SettingsPerson) {
        data = SettingsData(
            server: data.server,
            viewer: viewer,
            members: data.members.map { $0.id == viewer.id ? viewer : $0 },
            agents: data.agents,
            computers: data.computers
        )
    }

    private func updateAgent(_ agent: SettingsAgent) {
        let agents = data.agents.map { $0.id == agent.id ? agent : $0 }
        data = SettingsData(
            server: data.server,
            viewer: data.viewer,
            members: data.members,
            agents: agents,
            computers: data.computers
        )
    }

    private func saveDescription(ownerID: String, value: String) async throws {
        if data.viewer.id == ownerID {
            let viewer = data.viewer
            let draft = SettingsPerson(
                id: viewer.id,
                displayName: viewer.displayName,
                handle: viewer.handle,
                email: viewer.email,
                role: viewer.role,
                joined: viewer.joined,
                description: value,
                avatarURL: viewer.avatarURL,
                initials: viewer.initials
            )
            let saved = try await persistence.saveHumanProfile(
                draft.id,
                draft.displayName,
                draft.description
            )
            updateViewer(saved)
            return
        }

        guard let agent = data.agents.first(where: { $0.id == ownerID }) else { return }
        let draft = SettingsAgent(
            id: agent.id,
            displayName: agent.displayName,
            handle: agent.handle,
            description: value,
            role: agent.role,
            runtime: agent.runtime,
            model: agent.model,
            status: agent.status,
            avatarURL: agent.avatarURL,
            presence: agent.presence,
            initials: agent.initials
        )
        let saved = try await persistence.saveAgentProfile(
            draft.id,
            draft.displayName,
            draft.description
        )
        updateAgent(saved)
    }
}

#Preview("Settings sheet") {
    SettingsSheet(tasksPersistence: .preview)
}
