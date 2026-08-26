import Foundation

public enum AgentPresence: String, Sendable {
    case error
    case idle
    case offline
    case stopped
    case working
}

public struct AgentPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let avatarURL: URL?
    public let presence: AgentPresence

    public init(id: String, name: String, avatarURL: URL?, presence: AgentPresence) {
        self.id = id
        self.name = name
        self.avatarURL = avatarURL
        self.presence = presence
    }
}

public enum AgentActivityState: Hashable, Sendable {
    case active
    case completed
    case failed
}

public struct AgentActivityPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let occurredAt: Date
    public let state: AgentActivityState

    public init(id: String, title: String, occurredAt: Date, state: AgentActivityState) {
        self.id = id
        self.title = title
        self.occurredAt = occurredAt
        self.state = state
    }
}

public enum ChatKind: Hashable, Sendable {
    case channel
    case agentDirectMessage(AgentPresentation)
    case humanDirectMessage(HumanPresentation)
}


public struct ChatPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let title: String
    public let kind: ChatKind
    public let unreadCount: Int
    /// Channel-only. DMs keep their Agent avatar and ignore this.
    public let appearance: ChannelAppearance

    public init(
        id: String,
        title: String,
        kind: ChatKind,
        unreadCount: Int = 0,
        appearance: ChannelAppearance = .default
    ) {
        self.id = id
        self.title = title
        self.kind = kind
        self.unreadCount = unreadCount
        self.appearance = appearance
    }
}

public struct MessageAuthorPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let avatarURL: URL?
    public let presence: AgentPresence?

    public init(id: String, name: String, avatarURL: URL?, presence: AgentPresence? = nil) {
        self.id = id
        self.name = name
        self.avatarURL = avatarURL
        self.presence = presence
    }
}

public struct MessagePresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let author: MessageAuthorPresentation
    public let content: String
    public let createdAt: Date
    public let attachments: [MessageAttachmentPresentation]
    public let thread: ThreadPreviewPresentation?
    public let task: TaskPresentation?
    public let isPending: Bool
    public let preparedAction: PreparedActionPresentation?
    public let richSegments: [RichMessageSegment]

    public init(
        id: String,
        author: MessageAuthorPresentation,
        content: String,
        createdAt: Date,
        attachments: [MessageAttachmentPresentation] = [],
        thread: ThreadPreviewPresentation? = nil,
        task: TaskPresentation? = nil,
        isPending: Bool = false,
        preparedAction: PreparedActionPresentation? = nil,
        richSegments: [RichMessageSegment]? = nil
    ) {
        self.id = id
        self.author = author
        self.content = content
        self.createdAt = createdAt
        self.attachments = attachments
        self.thread = thread
        self.task = task
        self.isPending = isPending
        self.preparedAction = preparedAction
        self.richSegments = richSegments ?? RichMessageParser.parse(content) { _, _, _ in nil }
    }
}

public struct MessageAttachmentPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let filename: String
    public let mediaType: String
    public let sizeBytes: Int
    public let localURL: URL?

    public init(
        id: String,
        filename: String,
        mediaType: String,
        sizeBytes: Int,
        localURL: URL? = nil
    ) {
        self.id = id
        self.filename = filename
        self.mediaType = mediaType
        self.sizeBytes = sizeBytes
        self.localURL = localURL
    }

    public var isImage: Bool { mediaType.hasPrefix("image/") }
}

/// A local file staged by the native composer. The Server remains the owner of
/// durable attachment metadata and bytes after a successful send.
public struct ComposerAttachment: Identifiable, Hashable, Sendable {
    public let id: String
    public let filename: String
    public let mediaType: String
    public let sizeBytes: Int
    public let localURL: URL

    public init(
        id: String = UUID().uuidString.lowercased(),
        filename: String,
        mediaType: String,
        sizeBytes: Int,
        localURL: URL
    ) {
        self.id = id
        self.filename = filename
        self.mediaType = mediaType
        self.sizeBytes = sizeBytes
        self.localURL = localURL
    }

    public var presentation: MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: id,
            filename: filename,
            mediaType: mediaType,
            sizeBytes: sizeBytes,
            localURL: localURL
        )
    }
}

public struct ThreadPreviewPresentation: Hashable, Sendable {
    public let threadChatID: String
    public let replyCount: Int
    public let unreadCount: Int
    public let latestReply: ThreadReplyPresentation?

    public init(
        threadChatID: String,
        replyCount: Int,
        unreadCount: Int,
        latestReply: ThreadReplyPresentation?
    ) {
        self.threadChatID = threadChatID
        self.replyCount = replyCount
        self.unreadCount = unreadCount
        self.latestReply = latestReply
    }
}

public struct ThreadReplyPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let author: MessageAuthorPresentation
    public let content: String
    public let createdAt: Date

    public init(
        id: String,
        author: MessageAuthorPresentation,
        content: String,
        createdAt: Date
    ) {
        self.id = id
        self.author = author
        self.content = content
        self.createdAt = createdAt
    }
}

public enum TaskStatusPresentation: String, Hashable, Sendable {
    case todo = "To do"
    case inProgress = "In progress"
    case inReview = "In review"
    case done = "Done"
    case closed = "Closed"
}

public struct TaskPresentation: Hashable, Sendable {
    public let number: Int
    public let status: TaskStatusPresentation
    public let assignee: MessageAuthorPresentation?
    public let creator: MessageAuthorPresentation?

    public init(
        number: Int,
        status: TaskStatusPresentation,
        assignee: MessageAuthorPresentation?,
        creator: MessageAuthorPresentation? = nil
    ) {
        self.number = number
        self.status = status
        self.assignee = assignee
        self.creator = creator
    }
}

public struct ServerPresentation: Hashable, Sendable {
    public let name: String

    public init(name: String) {
        self.name = name
    }
}
