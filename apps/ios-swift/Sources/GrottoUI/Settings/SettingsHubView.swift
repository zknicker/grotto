import SwiftUI

struct SettingsHubView: View {
    let data: SettingsData
    @Binding var appearance: AppearancePreference
    let onNavigate: (SettingsRoute) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SettingsSection("You") {
                    SettingsListGroup {
                        SettingsIdentityRow(
                            initials: data.viewer.initials,
                            avatarURL: data.viewer.avatarURL,
                            title: "Profile",
                            subtitle: data.viewer.displayName,
                            action: { onNavigate(.profile) }
                        )
                    }
                }

                if !data.agents.isEmpty {
                    SettingsSection("Agent profiles") {
                        SettingsListGroup {
                            ForEach(Array(data.agents.enumerated()), id: \.element.id) { index, agent in
                                SettingsIdentityRow(
                                initials: agent.initials,
                                avatarURL: agent.avatarURL,
                                presence: agent.presence,
                                title: agent.displayName,
                                    subtitle: agent.description.isEmpty ? "Agent" : agent.description,
                                    showsDivider: index < data.agents.count - 1,
                                    action: { onNavigate(.agent(id: agent.id)) }
                                )
                            }
                        }
                    }
                }

                SettingsSection("Server") {
                    SettingsListGroup {
                        DisclosureRow(
                            "Server",
                            subtitle: data.server.name,
                            systemImage: "server.rack",
                            action: { onNavigate(.server) }
                        )
                        DisclosureRow(
                            "People",
                            systemImage: "person.2",
                            action: { onNavigate(.people) }
                        )
                        DisclosureRow(
                            "Computers",
                            systemImage: "desktopcomputer",
                            showsDivider: false,
                            action: { onNavigate(.computers) }
                        )
                    }
                }

                SettingsSection("Theme") {
                    SettingsListGroup {
                        PickerRow(
                            "Appearance",
                            value: appearance,
                            systemImage: "sun.max",
                            options: AppearancePreference.allCases.map { ($0, $0.title) },
                            onChange: { appearance = $0 }
                        )
                    }
                }

                SettingsSection("About") {
                    SettingsListGroup {
                        DisclosureRow(
                            "Grotto for iPhone",
                            subtitle: "Native client",
                            systemImage: "info.circle",
                            showsDivider: false,
                            action: { onNavigate(.appInfo) }
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
    }
}

private struct SettingsIdentityRow: View {
    let initials: String
    let avatarURL: URL?
    var presence: AgentPresence? = nil
    let title: String
    let subtitle: String
    var showsDivider = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                HStack(spacing: 14) {
                    AvatarView(
                        name: title,
                        url: avatarURL,
                        initials: initials,
                        presence: presence,
                        size: 42
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.body)
                            .foregroundStyle(.primary)
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .frame(minHeight: 76)
                .padding(.horizontal, 16)

                if showsDivider {
                    Divider().padding(.leading, 72)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open \(title) profile")
    }
}

#Preview("Settings hub") {
    NavigationStack {
        SettingsHubView(
            data: SettingsFixtures.data,
            appearance: .constant(.system),
            onNavigate: { _ in }
        )
        .navigationTitle("Settings")
    }
}
