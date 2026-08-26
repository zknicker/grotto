import Foundation

public enum ChatKind: String, Codable, Sendable {
    case channel
    case dm
}

public struct ChatSummary: Codable, Identifiable, Sendable, Equatable {
    public let archivedAt: Date?
    public let archivedByUserID: String?
    /// Channel appearance preset id, for example `violet`. Null on DMs and on
    /// channels that never picked one.
    public let color: String?
    public let createdAt: Date
    /// Channel appearance glyph, a curated hugeicons export name such as
    /// `RocketIcon`. Null on DMs and on channels that never picked one.
    public let icon: String?
    public let id: String
    public let isAll: Bool
    public let kind: ChatKind
    public let lastActivityAt: Date?
    public let lastMessageSequence: Int
    public let name: String?
    public let participantAgentIDs: [String]
    public let participantUserIDs: [String]
    public let peerAgentDisplayName: String?
    public let peerAgentID: String?
    public let peerAgentRetired: Bool
    public let peerUserID: String?
    public let serverID: String
    public let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case archivedAt
        case archivedByUserID = "archivedByUserId"
        case color
        case createdAt
        case icon
        case id
        case isAll
        case kind
        case lastActivityAt
        case lastMessageSequence
        case name
        case participantAgentIDs = "participantAgentIds"
        case participantUserIDs = "participantUserIds"
        case peerAgentDisplayName
        case peerAgentID = "peerAgentId"
        case peerAgentRetired
        case peerUserID = "peerUserId"
        case serverID = "serverId"
        case unreadCount
    }
}

/// `chat.get` returns the same shape as `chat.list`.
public typealias ChatDetail = ChatSummary

public struct ChatAuthorProfile: Codable, Sendable, Equatable {
    public let avatarURL: String?
    public let deleted: Bool
    public let description: String?
    public let displayName: String

    enum CodingKeys: String, CodingKey {
        case avatarURL = "avatarUrl"
        case deleted
        case description
        case displayName
    }

    public init(avatarURL: String?, deleted: Bool, description: String?, displayName: String) {
        self.avatarURL = avatarURL
        self.deleted = deleted
        self.description = description
        self.displayName = displayName
    }
}

public enum ChatAuthor: Codable, Sendable, Equatable {
    case agent(agentID: String, profile: ChatAuthorProfile?)
    case human(profile: ChatAuthorProfile?, userID: String)
    case system(SystemAuthor)

    public enum SystemAuthor: String, Codable, Sendable {
        case reminder
        case session
        // Production history can still contain retired task receipts. The UI filters
        // system-authored rows, but decoding must preserve access to the chat page.
        case task
    }

    public var kind: Kind {
        switch self {
        case .agent: return .agent
        case .human: return .human
        case .system: return .system
        }
    }

    public enum Kind: String, Sendable {
        case agent
        case human
        case system
    }

    private enum CodingKeys: String, CodingKey {
        case agentID = "agentId"
        case kind
        case profile
        case system
        case userID = "userId"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .kind) {
        case "agent":
            self = .agent(
                agentID: try container.decode(String.self, forKey: .agentID),
                profile: try container.decodeIfPresent(ChatAuthorProfile.self, forKey: .profile)
            )
        case "human":
            self = .human(
                profile: try container.decodeIfPresent(ChatAuthorProfile.self, forKey: .profile),
                userID: try container.decode(String.self, forKey: .userID)
            )
        case "system":
            self = .system(try container.decode(SystemAuthor.self, forKey: .system))
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .kind,
                in: container,
                debugDescription: "Unknown Grotto Chat author kind."
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .agent(agentID, profile):
            try container.encode("agent", forKey: .kind)
            try container.encode(agentID, forKey: .agentID)
            try container.encodeIfPresent(profile, forKey: .profile)
        case let .human(profile, userID):
            try container.encode("human", forKey: .kind)
            try container.encode(userID, forKey: .userID)
            try container.encodeIfPresent(profile, forKey: .profile)
        case let .system(system):
            try container.encode("system", forKey: .kind)
            try container.encode(system, forKey: .system)
        }
    }
}

public struct ChatMessage: Codable, Identifiable, Sendable, Equatable {
    public let attachments: [AttachmentMetadata]
    public let author: ChatAuthor
    public let chatID: String
    public let content: String
    public let createdAt: Date
    public let id: String
    public let nonce: String
    public let preparedAction: PreparedAction?
    public let runID: String?
    public let sequence: Int
    public let serverID: String
    public let task: MessageTask?

    enum CodingKeys: String, CodingKey {
        case attachments
        case author
        case chatID = "chatId"
        case content
        case createdAt
        case id
        case nonce
        case preparedAction
        case runID = "runId"
        case sequence
        case serverID = "serverId"
        case task
    }
}

public struct ThreadReplyPreview: Codable, Identifiable, Sendable, Equatable {
    public let authorAgentID: String?
    public let authorUserID: String?
    public let content: String
    public let createdAt: Date
    public let id: String

    enum CodingKeys: String, CodingKey {
        case authorAgentID = "authorAgentId"
        case authorUserID = "authorUserId"
        case content
        case createdAt
        case id
    }
}

public struct ThreadSummary: Codable, Identifiable, Sendable, Equatable {
    public let anchorMessageID: String
    public let followed: Bool
    public let latestReplyAt: Date?
    public let recentReplies: [ThreadReplyPreview]
    public let replyCount: Int
    public let threadChatID: String
    public let unreadCount: Int

    enum CodingKeys: String, CodingKey {
        case anchorMessageID = "anchorMessageId"
        case followed
        case latestReplyAt
        case recentReplies
        case replyCount
        case threadChatID = "threadChatId"
        case unreadCount
    }

    public var id: String { threadChatID }
}

public struct ChatMessagePage: Codable, Sendable, Equatable {
    public let messages: [ChatMessage]
    public let nextBeforeSequence: Int?
    public let threads: [ThreadSummary]

    public init(messages: [ChatMessage], nextBeforeSequence: Int?, threads: [ThreadSummary]) {
        self.messages = messages
        self.nextBeforeSequence = nextBeforeSequence
        self.threads = threads
    }

    /// Combines an older page with the currently visible page while keeping the
    /// timeline in server sequence order. The current page wins on duplicate ids
    /// so a foreground refresh remains authoritative for overlapping rows.
    public func merging(older olderPage: ChatMessagePage) -> ChatMessagePage {
        var messagesByID: [String: ChatMessage] = [:]
        for message in olderPage.messages {
            messagesByID[message.id] = message
        }
        for message in messages {
            messagesByID[message.id] = message
        }

        var threadsByAnchorID: [String: ThreadSummary] = [:]
        for thread in olderPage.threads {
            threadsByAnchorID[thread.anchorMessageID] = thread
        }
        for thread in threads {
            threadsByAnchorID[thread.anchorMessageID] = thread
        }

        return ChatMessagePage(
            messages: messagesByID.values.sorted {
                ($0.sequence, $0.id) < ($1.sequence, $1.id)
            },
            nextBeforeSequence: olderPage.nextBeforeSequence,
            threads: threadsByAnchorID.values.sorted {
                $0.anchorMessageID < $1.anchorMessageID
            }
        )
    }
}

public struct SendReceipt: Codable, Sendable, Equatable {
    public let eventCursor: String
    public let idempotent: Bool
    public let message: ChatMessage
    public let threadChatID: String?

    enum CodingKeys: String, CodingKey {
        case eventCursor
        case idempotent
        case message
        case threadChatID = "threadChatId"
    }

    public init(eventCursor: String, idempotent: Bool, message: ChatMessage, threadChatID: String?) {
        self.eventCursor = eventCursor
        self.idempotent = idempotent
        self.message = message
        self.threadChatID = threadChatID
    }
}
