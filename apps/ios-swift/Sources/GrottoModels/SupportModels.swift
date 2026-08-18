import Foundation

public struct AttachmentMetadata: Codable, Identifiable, Sendable, Equatable {
    public let filename: String
    public let id: String
    public let mediaType: String
    public let sizeBytes: Int

    public init(filename: String, id: String, mediaType: String, sizeBytes: Int) {
        self.filename = filename
        self.id = id
        self.mediaType = mediaType
        self.sizeBytes = sizeBytes
    }
}

public enum TaskStatus: String, Codable, Sendable {
    case todo
    case inProgress = "in_progress"
    case inReview = "in_review"
    case done
    case closed
}

public enum TaskPriority: String, Codable, Sendable {
    case none
    case urgent
    case high
    case medium
    case low
}

public enum TaskOrigin: String, Codable, Sendable {
    case composed
    case converted
}

public struct TaskLabel: Codable, Identifiable, Sendable, Equatable {
    public let color: String
    public let id: String
    public let name: String

    public init(color: String, id: String, name: String) {
        self.color = color
        self.id = id
        self.name = name
    }
}

public struct MessageTask: Codable, Identifiable, Sendable, Equatable {
    public let assigneeAgentID: String?
    public let assigneeUserID: String?
    public let chatID: String
    public let claimedAt: Date?
    public let createdAt: Date
    public let createdByAgentID: String?
    public let createdByUserID: String?
    public let labels: [TaskLabel]
    public let messageID: String
    public let number: Int
    public let origin: TaskOrigin
    public let priority: TaskPriority
    public let status: TaskStatus
    public let threadChatID: String
    public let updatedAt: Date
    public let version: Int

    public var id: String { messageID }

    enum CodingKeys: String, CodingKey {
        case assigneeAgentID = "assigneeAgentId"
        case assigneeUserID = "assigneeUserId"
        case chatID = "chatId"
        case claimedAt
        case createdAt
        case createdByAgentID = "createdByAgentId"
        case createdByUserID = "createdByUserId"
        case labels
        case messageID = "messageId"
        case number
        case origin
        case priority
        case status
        case threadChatID = "threadChatId"
        case updatedAt
        case version
    }
}
