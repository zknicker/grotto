import Foundation

/// Input for `member.updateProfile`.
///
/// `description` is nullable but required by the Server contract. The custom
/// encoder therefore writes `description: null` instead of omitting the key
/// when the profile has no description.
public struct UpdateHumanProfileInput: Codable, Equatable, Sendable {
    public let description: String?
    public let displayName: String

    public init(description: String?, displayName: String) {
        self.description = description
        self.displayName = displayName
    }

    private enum CodingKeys: String, CodingKey {
        case description
        case displayName
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        displayName = try container.decode(String.self, forKey: .displayName)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(description, forKey: .description)
        try container.encode(displayName, forKey: .displayName)
    }
}

/// Input for `agent.updateProfile`.
public struct UpdateAgentProfileInput: Codable, Equatable, Sendable {
    public let agentID: String
    public let description: String?
    public let displayName: String
    public let serverID: String

    public init(agentID: String, description: String?, displayName: String, serverID: String) {
        self.agentID = agentID
        self.description = description
        self.displayName = displayName
        self.serverID = serverID
    }

    private enum CodingKeys: String, CodingKey {
        case agentID = "agentId"
        case description
        case displayName
        case serverID = "serverId"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        agentID = try container.decode(String.self, forKey: .agentID)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        displayName = try container.decode(String.self, forKey: .displayName)
        serverID = try container.decode(String.self, forKey: .serverID)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(agentID, forKey: .agentID)
        try container.encode(description, forKey: .description)
        try container.encode(displayName, forKey: .displayName)
        try container.encode(serverID, forKey: .serverID)
    }
}

public enum AvatarMediaType: String, Codable, Equatable, Sendable {
    case jpeg = "image/jpeg"
    case png = "image/png"
    case webp = "image/webp"
}

/// The Server's avatar owner discriminator. A user target always means the
/// signed-in human; an agent target is authorized against the supplied server.
public enum AvatarTarget: Codable, Equatable, Sendable {
    case user
    case agent(agentID: String)

    private enum CodingKeys: String, CodingKey {
        case agentID = "agentId"
        case kind
    }

    private enum Kind: String, Codable {
        case agent
        case user
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .kind) {
        case .agent:
            self = .agent(agentID: try container.decode(String.self, forKey: .agentID))
        case .user:
            self = .user
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .user:
            try container.encode(Kind.user, forKey: .kind)
        case let .agent(agentID):
            try container.encode(agentID, forKey: .agentID)
            try container.encode(Kind.agent, forKey: .kind)
        }
    }
}

/// Input for `avatar.set`. Image bytes must already be resized by the client
/// and represented as base64; the Server enforces the byte and media limits.
public struct SetAvatarInput: Codable, Equatable, Sendable {
    public let bytesBase64: String
    public let mediaType: AvatarMediaType
    public let serverID: String
    public let target: AvatarTarget

    public init(
        bytesBase64: String,
        mediaType: AvatarMediaType,
        serverID: String,
        target: AvatarTarget
    ) {
        self.bytesBase64 = bytesBase64
        self.mediaType = mediaType
        self.serverID = serverID
        self.target = target
    }

    private enum CodingKeys: String, CodingKey {
        case bytesBase64
        case mediaType
        case serverID = "serverId"
        case target
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        bytesBase64 = try container.decode(String.self, forKey: .bytesBase64)
        mediaType = try container.decode(AvatarMediaType.self, forKey: .mediaType)
        serverID = try container.decode(String.self, forKey: .serverID)
        target = try container.decode(AvatarTarget.self, forKey: .target)
    }
}

/// Input for `avatar.clear`.
public struct ClearAvatarInput: Codable, Equatable, Sendable {
    public let serverID: String
    public let target: AvatarTarget

    public init(serverID: String, target: AvatarTarget) {
        self.serverID = serverID
        self.target = target
    }

    private enum CodingKeys: String, CodingKey {
        case serverID = "serverId"
        case target
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        serverID = try container.decode(String.self, forKey: .serverID)
        target = try container.decode(AvatarTarget.self, forKey: .target)
    }
}

/// Response returned by both `avatar.set` and `avatar.clear`.
public struct Avatar: Codable, Equatable, Sendable {
    public let avatarID: String?
    public let avatarURL: String?

    public init(avatarID: String?, avatarURL: String?) {
        self.avatarID = avatarID
        self.avatarURL = avatarURL
    }

    private enum CodingKeys: String, CodingKey {
        case avatarID = "avatarId"
        case avatarURL = "avatarUrl"
    }
}

