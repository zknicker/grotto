import SwiftUI

struct HumanProfileView: View {
    let person: SettingsPerson
    let onEditDescription: (String, String, String) -> Void
    let onSave: (SettingsPerson) async throws -> SettingsPerson
    let onSaveAvatar: @Sendable (AvatarImagePayload) async throws -> Void
    @State private var name: String
    @State private var savedName: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(
        person: SettingsPerson,
        onEditDescription: @escaping (String, String, String) -> Void,
        onSave: @escaping (SettingsPerson) async throws -> SettingsPerson = { $0 },
        onSaveAvatar: @escaping @Sendable (AvatarImagePayload) async throws -> Void = { _ in }
    ) {
        self.person = person
        self.onEditDescription = onEditDescription
        self.onSave = onSave
        self.onSaveAvatar = onSaveAvatar
        _name = State(initialValue: person.displayName)
        _savedName = State(initialValue: person.displayName)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ProfileHero(
                    initials: person.initials,
                    avatarURL: person.avatarURL,
                    displayName: name,
                    handle: person.handle.map { "@\($0)" },
                    onSaveAvatar: onSaveAvatar
                )

                SettingsSection("Identity") {
                    SettingsListGroup {
                        SettingsRow(title: "Name", systemImage: "person", showsDivider: true) {
                            TextField("Name", text: $name)
                                .font(.body)
                                .multilineTextAlignment(.trailing)
                                .grottoWordsAutocapitalization()
                                .submitLabel(.done)
                                .onSubmit { Task { await saveName() } }
                                .accessibilityLabel("Name")
                        }
                        DisclosureRow(
                            "Description",
                            subtitle: person.description.isEmpty ? "No description yet." : person.description,
                            systemImage: "text.alignleft",
                            showsDivider: false,
                            action: {
                                onEditDescription(person.id, "Description", person.description)
                            }
                        )
                    }
                }

                SettingsSection("Account") {
                    SettingsListGroup {
                        ValueRow("Handle", value: person.handle.map { "@\($0)" } ?? "—", systemImage: "at")
                        ValueRow("Email", value: person.email ?? "Unavailable", systemImage: "envelope")
                        ValueRow("Role", value: person.role, systemImage: "person.badge.key")
                        ValueRow("Joined", value: person.joined.isEmpty ? "Unavailable" : person.joined, systemImage: "calendar", showsDivider: false)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal, 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("Profile")
        .grottoInlineNavigationTitle()
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    Task { await saveName() }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save")
                    }
                }
                .disabled(!hasNameChanges || isSaving)
                .accessibilityLabel("Save name")
            }
        }
    }

    private var hasNameChanges: Bool {
        name.trimmingCharacters(in: .whitespacesAndNewlines) != savedName
    }

    private func saveName() async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty, trimmedName != savedName, !isSaving else { return }

        isSaving = true
        errorMessage = nil
        do {
            let draft = SettingsPerson(
                id: person.id,
                displayName: trimmedName,
                handle: person.handle,
                email: person.email,
                role: person.role,
                joined: person.joined,
                description: person.description,
                avatarURL: person.avatarURL,
                initials: person.initials
            )
            let saved = try await onSave(draft)
            name = saved.displayName
            savedName = saved.displayName
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

struct AgentProfileView: View {
    let agent: SettingsAgent
    let onEditDescription: (String, String, String) -> Void
    let onSave: (SettingsAgent) async throws -> SettingsAgent
    let onSaveAvatar: @Sendable (AvatarImagePayload) async throws -> Void
    @State private var name: String
    @State private var savedName: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(
        agent: SettingsAgent,
        onEditDescription: @escaping (String, String, String) -> Void,
        onSave: @escaping (SettingsAgent) async throws -> SettingsAgent = { $0 },
        onSaveAvatar: @escaping @Sendable (AvatarImagePayload) async throws -> Void = { _ in }
    ) {
        self.agent = agent
        self.onEditDescription = onEditDescription
        self.onSave = onSave
        self.onSaveAvatar = onSaveAvatar
        _name = State(initialValue: agent.displayName)
        _savedName = State(initialValue: agent.displayName)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ProfileHero(
                    initials: agent.initials,
                    avatarURL: agent.avatarURL,
                    presence: agent.presence,
                    displayName: name,
                    handle: "@\(agent.handle)",
                    onSaveAvatar: onSaveAvatar
                )

                SettingsSection("Identity") {
                    SettingsListGroup {
                        SettingsRow(title: "Name", systemImage: "person", showsDivider: true) {
                            TextField("Name", text: $name)
                                .font(.body)
                                .multilineTextAlignment(.trailing)
                                .grottoWordsAutocapitalization()
                                .submitLabel(.done)
                                .onSubmit { Task { await saveName() } }
                                .accessibilityLabel("Name")
                        }
                        DisclosureRow(
                            "Description",
                            subtitle: agent.description.isEmpty ? "No description yet." : agent.description,
                            systemImage: "text.alignleft",
                            showsDivider: false,
                            action: {
                                onEditDescription(agent.id, "Description", agent.description)
                            }
                        )
                    }
                }

                SettingsSection("Details") {
                    SettingsListGroup {
                        ValueRow("Handle", value: "@\(agent.handle)", systemImage: "at")
                        ValueRow("Role", value: agent.role, systemImage: "person.badge.key", showsDivider: false)
                    }
                }

                SettingsSection("Execution") {
                    SettingsListGroup {
                        ValueRow("Runtime", value: agent.runtime, systemImage: "terminal")
                        ValueRow("Model", value: agent.model, systemImage: "cpu")
                        ValueRow("Status", value: agent.status, systemImage: "gearshape", showsDivider: false)
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal, 16)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle(agent.displayName)
        .grottoInlineNavigationTitle()
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button {
                    Task { await saveName() }
                } label: {
                    if isSaving {
                        ProgressView()
                    } else {
                        Text("Save")
                    }
                }
                .disabled(!hasNameChanges || isSaving)
                .accessibilityLabel("Save name")
            }
        }
    }

    private var hasNameChanges: Bool {
        name.trimmingCharacters(in: .whitespacesAndNewlines) != savedName
    }

    private func saveName() async {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty, trimmedName != savedName, !isSaving else { return }

        isSaving = true
        errorMessage = nil
        do {
            let draft = SettingsAgent(
                id: agent.id,
                displayName: trimmedName,
                handle: agent.handle,
                description: agent.description,
                role: agent.role,
                runtime: agent.runtime,
                model: agent.model,
                status: agent.status,
                avatarURL: agent.avatarURL,
                presence: agent.presence,
                initials: agent.initials
            )
            let saved = try await onSave(draft)
            name = saved.displayName
            savedName = saved.displayName
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }
}

#Preview("Human profile") {
    NavigationStack {
        HumanProfileView(person: SettingsFixtures.viewer) { _, _, _ in }
    }
}

#Preview("Agent profile") {
    NavigationStack {
        AgentProfileView(agent: SettingsFixtures.cove) { _, _, _ in }
    }
}
