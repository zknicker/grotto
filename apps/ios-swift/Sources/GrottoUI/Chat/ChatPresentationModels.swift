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
    case directMessage(agent: AgentPresentation)
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

    public init(
        id: String,
        author: MessageAuthorPresentation,
        content: String,
        createdAt: Date,
        attachments: [MessageAttachmentPresentation] = [],
        thread: ThreadPreviewPresentation? = nil,
        task: TaskPresentation? = nil,
        isPending: Bool = false
    ) {
        self.id = id
        self.author = author
        self.content = content
        self.createdAt = createdAt
        self.attachments = attachments
        self.thread = thread
        self.task = task
        self.isPending = isPending
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
    public let agentCount: Int
    public let memberCount: Int

    public init(name: String, agentCount: Int, memberCount: Int) {
        self.name = name
        self.agentCount = agentCount
        self.memberCount = memberCount
    }
}

public enum ChatFixtures {
    public static let cove = AgentPresentation(
        id: "agent-cove",
        name: "Cove",
        avatarURL: nil,
        presence: .idle
    )

    public static let server = ServerPresentation(name: "Grotto", agentCount: 2, memberCount: 1)

    public static let chats = [
        ChatPresentation(id: "all", title: "all", kind: .channel),
        ChatPresentation(
            id: "product",
            title: "product",
            kind: .channel,
            unreadCount: 3,
            appearance: ChannelAppearance(icon: "RocketIcon", color: "violet")
        ),
        ChatPresentation(
            id: "onboarding",
            title: "onboarding-owner",
            kind: .channel,
            appearance: ChannelAppearance(icon: "CompassIcon", color: "amber")
        ),
        ChatPresentation(id: "cove", title: "Cove", kind: .directMessage(agent: cove)),
    ]

    public static let messages = [
        MessagePresentation(
            id: "message-1",
            author: MessageAuthorPresentation(id: "zach", name: "Zach Knickerbocker", avatarURL: nil),
            content: "Morning team — what should we focus on today?",
            createdAt: .now.addingTimeInterval(-180)
        ),
        MessagePresentation(
            id: "message-2",
            author: MessageAuthorPresentation(
                id: cove.id,
                name: cove.name,
                avatarURL: cove.avatarURL,
                presence: cove.presence
            ),
            content: "I’ll keep the plan tight and surface decisions early. The native shell can diverge at the rendering layer while the Server contract stays shared.",
            createdAt: .now.addingTimeInterval(-120),
            thread: ThreadPreviewPresentation(
                threadChatID: "thread-message-2",
                replyCount: 2,
                unreadCount: 1,
                latestReply: ThreadReplyPresentation(
                    id: "reply-2",
                    author: MessageAuthorPresentation(
                        id: "zach",
                        name: "Zach Knickerbocker",
                        avatarURL: nil
                    ),
                    content: "Let’s use one compact preview and keep the full conversation in the thread.",
                    createdAt: .now.addingTimeInterval(-75)
                )
            )
        ),
        MessagePresentation(
            id: "message-3",
            author: MessageAuthorPresentation(id: "zach", name: "Zach Knickerbocker", avatarURL: nil),
            content: "Perfect. Let’s prove the daily chat loop in the simulator first.",
            createdAt: .now.addingTimeInterval(-60),
            thread: ThreadPreviewPresentation(
                threadChatID: "thread-message-3",
                replyCount: 3,
                unreadCount: 0,
                latestReply: ThreadReplyPresentation(
                    id: "reply-3",
                    author: MessageAuthorPresentation(
                        id: cove.id,
                        name: cove.name,
                        avatarURL: cove.avatarURL,
                        presence: cove.presence
                    ),
                    content: "The Server contract is already carrying the task and reply data we need.",
                    createdAt: .now.addingTimeInterval(-25)
                )
            ),
            task: TaskPresentation(
                number: 42,
                status: .inProgress,
                assignee: nil,
                creator: MessageAuthorPresentation(
                    id: "zach",
                    name: "Zach Knickerbocker",
                    avatarURL: nil
                )
            )
        ),
    ]
}
