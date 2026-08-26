import Foundation

public enum AgentReasoningEffort: String, Codable, CaseIterable, Sendable, Equatable {
    case low
    case medium
    case high
}

public enum PreparedActionStatus: String, Codable, Sendable, Equatable {
    case executed
    case pending
    case superseded
}

public enum PreparedActionAvatarMediaType: String, Codable, Sendable, Equatable {
    case jpeg = "image/jpeg"
    case png = "image/png"
    case webp = "image/webp"
}

public struct PreparedActionMedia: Codable, Identifiable, Sendable, Equatable {
    public let byteSize: Int
    public let id: String
    public let mediaType: PreparedActionAvatarMediaType
    public let sha256: String
    public let url: String
}

public enum PreparedActionComputerGuidance: Codable, Sendable, Equatable {
    case required(computerID: String, label: String?)
    case suggested(computerID: String, label: String?)

    private enum CodingKeys: String, CodingKey {
        case computerID = "computerId"
        case kind
        case label
    }

    private enum Kind: String, Codable {
        case required
        case suggested
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let computerID = try container.decode(String.self, forKey: .computerID)
        let label = try container.decodeIfPresent(String.self, forKey: .label)
        switch try container.decode(Kind.self, forKey: .kind) {
        case .required:
            self = .required(computerID: computerID, label: label)
        case .suggested:
            self = .suggested(computerID: computerID, label: label)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .required(computerID, label):
            try container.encode(Kind.required, forKey: .kind)
            try container.encode(computerID, forKey: .computerID)
            try container.encodeIfPresent(label, forKey: .label)
        case let .suggested(computerID, label):
            try container.encode(Kind.suggested, forKey: .kind)
            try container.encode(computerID, forKey: .computerID)
            try container.encodeIfPresent(label, forKey: .label)
        }
    }

    public var computerID: String {
        switch self {
        case let .required(computerID, _), let .suggested(computerID, _): computerID
        }
    }

    public var label: String? {
        switch self {
        case let .required(_, label), let .suggested(_, label): label
        }
    }

    public var kindLabel: String {
        switch self {
        case .required: "Required"
        case .suggested: "Suggested"
        }
    }
}

public struct PreparedCreateAgentProposal: Codable, Sendable, Equatable {
    public let avatar: PreparedActionMedia
    public let computer: PreparedActionComputerGuidance?
    public let description: String?
    public let draftHint: String?
    public let kind: String
    public let name: String
}

public struct PreparedCreateAgentResult: Codable, Sendable, Equatable {
    public let agentID: String
    public let avatarURL: String?
    public let computerID: String
    public let description: String?
    public let displayName: String
    public let handle: String
    public let modelID: String
    public let reasoningEffort: AgentReasoningEffort
    public let role: AgentRole
    public let runtimeID: String

    enum CodingKeys: String, CodingKey {
        case agentID = "agentId"
        case avatarURL = "avatarUrl"
        case computerID = "computerId"
        case description
        case displayName
        case handle
        case modelID = "modelId"
        case reasoningEffort
        case role
        case runtimeID = "runtimeId"
    }
}

public struct PreparedCreateAgentAction: Codable, Identifiable, Sendable, Equatable {
    public let chatID: String
    public let createdAt: Date
    public let executedAt: Date?
    public let executedByUserID: String?
    public let id: String
    public let kind: String
    public let messageID: String
    public let proposal: PreparedCreateAgentProposal
    public let proposerAgentID: String
    public let result: PreparedCreateAgentResult?
    public let status: PreparedActionStatus
    public let supersededAt: Date?
    public let supersededByActionID: String?

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case createdAt
        case executedAt
        case executedByUserID = "executedByUserId"
        case id
        case kind
        case messageID = "messageId"
        case proposal
        case proposerAgentID = "proposerAgentId"
        case result
        case status
        case supersededAt
        case supersededByActionID = "supersededByActionId"
    }
}

public struct UnsupportedPreparedAction: Codable, Identifiable, Sendable, Equatable {
    public let chatID: String
    public let createdAt: Date
    public let executedAt: Date?
    public let executedByUserID: String?
    public let id: String
    public let kind: String
    public let messageID: String
    public let proposerAgentID: String
    public let status: PreparedActionStatus
    public let supersededAt: Date?
    public let supersededByActionID: String?

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case createdAt
        case executedAt
        case executedByUserID = "executedByUserId"
        case id
        case kind
        case messageID = "messageId"
        case proposerAgentID = "proposerAgentId"
        case status
        case supersededAt
        case supersededByActionID = "supersededByActionId"
    }
}

/// Known actions decode to their typed contract. Future kinds remain inert but
/// preserve the lifecycle fields needed to render a safe unsupported card.
public enum PreparedAction: Codable, Identifiable, Sendable, Equatable {
    case createAgent(PreparedCreateAgentAction)
    case unsupported(UnsupportedPreparedAction)

    private enum KindKey: String, CodingKey { case kind }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: KindKey.self)
        if try container.decode(String.self, forKey: .kind) == "agent:create" {
            self = .createAgent(try PreparedCreateAgentAction(from: decoder))
        } else {
            self = .unsupported(try UnsupportedPreparedAction(from: decoder))
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case let .createAgent(action): try action.encode(to: encoder)
        case let .unsupported(action): try action.encode(to: encoder)
        }
    }

    public var id: String {
        switch self {
        case let .createAgent(action): action.id
        case let .unsupported(action): action.id
        }
    }
}

public struct AvatarBytesInput: Codable, Sendable, Equatable {
    public let bytesBase64: String
    public let mediaType: PreparedActionAvatarMediaType

    public init(bytesBase64: String, mediaType: PreparedActionAvatarMediaType) {
        self.bytesBase64 = bytesBase64
        self.mediaType = mediaType
    }
}

public struct PreparedActionCommitInput: Encodable, Sendable, Equatable {
    public let actionID: String
    public let avatar: AvatarBytesInput?
    public let computerID: String
    public let description: String?
    public let displayName: String
    public let handle: String
    public let modelID: String
    public let reasoningEffort: AgentReasoningEffort
    public let runtimeID: String
    public let serverID: String

    public init(
        actionID: String,
        avatar: AvatarBytesInput?,
        computerID: String,
        description: String?,
        displayName: String,
        handle: String,
        modelID: String,
        reasoningEffort: AgentReasoningEffort,
        runtimeID: String,
        serverID: String
    ) {
        self.actionID = actionID
        self.avatar = avatar
        self.computerID = computerID
        self.description = description
        self.displayName = displayName
        self.handle = handle
        self.modelID = modelID
        self.reasoningEffort = reasoningEffort
        self.runtimeID = runtimeID
        self.serverID = serverID
    }

    enum CodingKeys: String, CodingKey {
        case actionID = "actionId"
        case avatar
        case computerID = "computerId"
        case description
        case displayName
        case handle
        case modelID = "modelId"
        case reasoningEffort
        case runtimeID = "runtimeId"
        case serverID = "serverId"
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(actionID, forKey: .actionID)
        try container.encodeIfPresent(avatar, forKey: .avatar)
        try container.encode(computerID, forKey: .computerID)
        try container.encode(description, forKey: .description)
        try container.encode(displayName, forKey: .displayName)
        try container.encode(handle, forKey: .handle)
        try container.encode(modelID, forKey: .modelID)
        try container.encode(reasoningEffort, forKey: .reasoningEffort)
        try container.encode(runtimeID, forKey: .runtimeID)
        try container.encode(serverID, forKey: .serverID)
    }
}

public struct PreparedActionCommitResult: Codable, Sendable, Equatable {
    public let action: PreparedAction
    public let agent: AgentSummary
    public let idempotent: Bool
}
