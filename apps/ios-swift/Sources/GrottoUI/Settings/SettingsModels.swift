import Foundation
import GrottoModels

/// Presentation data for the native settings sheet.
///
/// The Server remains the source of truth. These small value types keep the SwiftUI
/// surface independent from transport/client response shapes and make previews cheap.
public struct SettingsServer: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let slug: String
    public let role: String
    public let memberCount: Int
    public let agentCount: Int

    public init(
        id: String,
        name: String,
        slug: String,
        role: String,
        memberCount: Int,
        agentCount: Int
    ) {
        self.id = id
        self.name = name
        self.slug = slug
        self.role = role
        self.memberCount = memberCount
        self.agentCount = agentCount
    }
}

public struct SettingsPerson: Identifiable, Hashable, Sendable {
    public let id: String
    public let displayName: String
    public let handle: String?
    public let email: String?
    public let role: String
    public let joined: String
    public let description: String
    public let avatarURL: URL?
    public let initials: String

    public init(
        id: String,
        displayName: String,
        handle: String? = nil,
        email: String? = nil,
        role: String = "Member",
        joined: String = "",
        description: String = "",
        avatarURL: URL? = nil,
        initials: String? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.email = email
        self.role = role
        self.joined = joined
        self.description = description
        self.avatarURL = avatarURL
        self.initials = initials ?? Self.makeInitials(from: displayName)
    }

    private static func makeInitials(from name: String) -> String {
        let parts = name.split(whereSeparator: { $0 == " " || $0 == "-" })
        let letters = parts.prefix(2).compactMap(\.first)
        return String(letters).uppercased()
    }
}

public struct SettingsAgent: Identifiable, Hashable, Sendable {
    public let id: String
    public let displayName: String
    public let handle: String
    public let description: String
    public let role: String
    public let runtime: String
    public let model: String
    public let status: String
    public let avatarURL: URL?
    public let presence: AgentPresence
    public let initials: String

    public init(
        id: String,
        displayName: String,
        handle: String,
        description: String = "",
        role: String = "Agent",
        runtime: String = "Managed",
        model: String = "Default",
        status: String = "Online",
        avatarURL: URL? = nil,
        presence: AgentPresence = .idle,
        initials: String? = nil
    ) {
        self.id = id
        self.displayName = displayName
        self.handle = handle
        self.description = description
        self.role = role
        self.runtime = runtime
        self.model = model
        self.status = status
        self.avatarURL = avatarURL
        self.presence = presence
        self.initials = initials ?? Self.makeInitials(from: displayName)
    }

    private static func makeInitials(from name: String) -> String {
        let parts = name.split(whereSeparator: { $0 == " " || $0 == "-" })
        let letters = parts.prefix(2).compactMap(\.first)
        return String(letters).uppercased()
    }
}

/// Native settings projection of the Server-backed `computer.list` result.
/// Keeping display labels here means SwiftUI does not depend on wire models.
public struct SettingsComputer: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let health: String
    public let system: String
    public let version: String

    public init(id: String, name: String, health: String, system: String, version: String) {
        self.id = id
        self.name = name
        self.health = health
        self.system = system
        self.version = version
    }
}

public struct SettingsData: Hashable, Sendable {
    public let server: SettingsServer
    public let viewer: SettingsPerson
    public let members: [SettingsPerson]
    public let agents: [SettingsAgent]
    public let computers: [SettingsComputer]?

    public init(
        server: SettingsServer,
        viewer: SettingsPerson,
        members: [SettingsPerson] = [],
        agents: [SettingsAgent],
        computers: [SettingsComputer]? = nil
    ) {
        self.server = server
        self.viewer = viewer
        self.members = members
        self.agents = agents
        self.computers = computers
    }
}

/// Server-backed profile mutations owned by the app/client layer.
///
/// The settings views deliberately do not know about tRPC, authentication, or
/// transport errors. Callers provide narrow mutation seams and return the
/// canonical value from the Server after a successful write. Avatar payloads
/// have already been resized and validated by `AvatarPhotoPicker`.
public struct SettingsPersistence: Sendable {
    public let saveHumanProfile: @Sendable (String, String, String) async throws -> SettingsPerson
    public let saveAgentProfile: @Sendable (String, String, String) async throws -> SettingsAgent
    public let saveHumanAvatar: @Sendable (String, AvatarImagePayload) async throws -> SettingsPerson
    public let saveAgentAvatar: @Sendable (String, AvatarImagePayload) async throws -> SettingsAgent

    public init(
        saveHumanProfile: @escaping @Sendable (String, String, String) async throws -> SettingsPerson,
        saveAgentProfile: @escaping @Sendable (String, String, String) async throws -> SettingsAgent,
        saveHumanAvatar: @escaping @Sendable (String, AvatarImagePayload) async throws -> SettingsPerson,
        saveAgentAvatar: @escaping @Sendable (String, AvatarImagePayload) async throws -> SettingsAgent
    ) {
        self.saveHumanProfile = saveHumanProfile
        self.saveAgentProfile = saveAgentProfile
        self.saveHumanAvatar = saveHumanAvatar
        self.saveAgentAvatar = saveAgentAvatar
    }

    public static let preview = SettingsPersistence(
        saveHumanProfile: { id, displayName, description in
            let person = SettingsFixtures.viewer
            return SettingsPerson(
                id: id,
                displayName: displayName,
                handle: person.handle,
                email: person.email,
                role: person.role,
                joined: person.joined,
                description: description,
                avatarURL: person.avatarURL,
                initials: person.initials
            )
        },
        saveAgentProfile: { id, displayName, description in
            let agent = SettingsFixtures.cove
            return SettingsAgent(
                id: id,
                displayName: displayName,
                handle: agent.handle,
                description: description,
                role: agent.role,
                runtime: agent.runtime,
                model: agent.model,
                status: agent.status,
                avatarURL: agent.avatarURL,
                presence: agent.presence,
                initials: agent.initials
            )
        },
        saveHumanAvatar: { _, _ in
            SettingsFixtures.viewer
        },
        saveAgentAvatar: { _, _ in
            SettingsFixtures.cove
        }
    )
}

public enum SettingsFixtures {
    public static let server = SettingsServer(
        id: "server-tavern",
        name: "Tavern",
        slug: "tavern",
        role: "Owner",
        memberCount: 1,
        agentCount: 1
    )

    public static let viewer = SettingsPerson(
        id: "member-zach",
        displayName: "Zach Knickerbocker",
        handle: "zachknickerbocker",
        email: "zknicker@gmail.com",
        role: "Owner",
        joined: "Aug 11, 2026",
        initials: "ZK"
    )

    public static let cove = SettingsAgent(
        id: "agent-cove",
        displayName: "Cove",
        handle: "cove",
        description: "Onboarding Assistant",
        role: "Guide Agent",
        runtime: "Computer",
        model: "Default",
        status: "Online",
        initials: "CO"
    )

    public static let computers = [
        SettingsComputer(
            id: "computer-preview",
            name: "Zach's MacBook Pro",
            health: "Online",
            system: "Mac · Apple Silicon",
            version: "v1.0.0"
        ),
    ]

    public static let data = SettingsData(
        server: server,
        viewer: viewer,
        members: [viewer],
        agents: [cove],
        computers: computers
    )
}
