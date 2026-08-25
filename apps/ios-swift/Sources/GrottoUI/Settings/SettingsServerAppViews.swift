import SwiftUI

struct ServerDetailsView: View {
    let server: SettingsServer

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SettingsSection("Identity") {
                    SettingsListGroup {
                        ValueRow("Name", value: server.name, icon: .server)
                        ValueRow("Address", value: "/\(server.slug)", icon: .website)
                        ValueRow("Your role", value: server.role, icon: .permissions, showsDivider: false)
                    }
                }

                SettingsSection("People") {
                    SettingsListGroup {
                        ValueRow("Agents", value: String(server.agentCount), icon: .agents)
                        ValueRow("Members", value: String(server.memberCount), icon: .members, showsDivider: false)
                    }
                }

                Text("Server identity is shared with every Grotto client.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("Server")
        .grottoInlineNavigationTitle()
    }
}

struct AppInfoView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SettingsSection("About") {
                    SettingsListGroup {
                        ValueRow("Version", value: AppVersionInfo.current, icon: .info, showsDivider: false)
                    }
                }

                Text("Grotto for iPhone connects to your Grotto Server and Computers.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 16)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("Grotto for iPhone")
        .grottoInlineNavigationTitle()
    }
}

struct ServerPeopleView: View {
    let members: [SettingsPerson]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SettingsSection("Members") {
                    SettingsListGroup {
                        if members.isEmpty {
                            SettingsRow(
                                title: "No members",
                                icon: .members,
                                showsDivider: false
                            ) {
                                EmptyView()
                            }
                        } else {
                            ForEach(Array(members.enumerated()), id: \.element.id) { index, member in
                                SettingsMemberRow(
                                    member: member,
                                    showsDivider: index < members.count - 1
                                )
                            }
                        }
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("People")
        .grottoInlineNavigationTitle()
    }
}

private struct SettingsMemberRow: View {
    let member: SettingsPerson
    let showsDivider: Bool

    private var subtitle: String? {
        if let email = member.email, email != member.displayName {
            return email
        }
        guard let handle = member.handle, !handle.isEmpty else { return nil }
        return "@\(handle)"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                AvatarView(
                    name: member.displayName,
                    url: member.avatarURL,
                    initials: member.initials,
                    size: 42
                )

                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)
                Text(member.role)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(minHeight: 76)
            .padding(.horizontal, 16)

            if showsDivider {
                Divider().padding(.leading, 72)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(member.displayName), \(member.role)")
    }
}

struct ServerComputersView: View {
    let computers: [SettingsComputer]?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                SettingsSection("Computers") {
                    SettingsListGroup {
                        if let computers, !computers.isEmpty {
                            ForEach(Array(computers.enumerated()), id: \.element.id) { index, computer in
                                SettingsComputerRow(
                                    computer: computer,
                                    showsDivider: index < computers.count - 1
                                )
                            }
                        } else {
                            SettingsRow(
                                title: computers == nil ? "Computers unavailable" : "No Computers attached",
                                subtitle: computers == nil
                                    ? "Grotto couldn’t load this Server’s Computers."
                                    : "No Computer has connected to this Server yet.",
                                icon: .computer,
                                showsDivider: false
                            ) {
                                EmptyView()
                            }
                        }
                    }
                }

                if let computers, computers.count > 1 {
                    Text("Computers are managed by the Grotto Computer app.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 16)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("Computers")
        .grottoInlineNavigationTitle()
    }
}

private struct SettingsComputerRow: View {
    let computer: SettingsComputer
    let showsDivider: Bool

    private var subtitle: String {
        "\(computer.health) · \(computer.system)"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                GrottoIcon(.computer, size: 21, weight: 1.8)
                    .frame(width: 24)
                    .foregroundStyle(.primary)

                VStack(alignment: .leading, spacing: 2) {
                    Text(computer.name)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        Circle()
                            .fill(computer.isHealthy ? Color.green : Color.secondary)
                            .frame(width: 8, height: 8)
                            .accessibilityHidden(true)
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)
                Text(computer.version)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(minHeight: 76)
            .padding(.horizontal, 16)

            if showsDivider {
                Divider().padding(.leading, 54)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(computer.name), \(subtitle)")
    }
}

struct SettingsUnavailableView: View {
    let title: String

    var body: some View {
        // `ContentUnavailableView` is a system surface and takes an SF Symbol.
        ContentUnavailableView(
            title,
            systemImage: "questionmark.circle",
            description: Text("This settings screen is unavailable.")
        )
        .navigationTitle(title)
        .grottoInlineNavigationTitle()
    }
}

#Preview("Server") {
    NavigationStack {
        ServerDetailsView(server: SettingsFixtures.server)
    }
}

#Preview("App info") {
    NavigationStack {
        AppInfoView()
    }
}

#Preview("People") {
    NavigationStack {
        ServerPeopleView(members: [SettingsFixtures.viewer])
    }
}
