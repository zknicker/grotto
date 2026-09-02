import Foundation

public enum ChatFixtures {
    public static let cove = AgentPresentation(
        id: "agent-cove",
        name: "Cove",
        avatarURL: nil,
        presence: .idle
    )

    public static let server = ServerPresentation(name: "Grotto")

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
        ChatPresentation(id: "cove", title: "Cove", kind: .agentDirectMessage(cove)),
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

    public static let pendingAgentProposal = PreparedCreateAgentActionPresentation(
        avatarURL: nil,
        chatID: "product",
        computerDetail: "Mac mini (suggested)",
        createdAt: .now.addingTimeInterval(-120),
        description: "Release manager. Watches CI and prepares releases.json.",
        draftHint: "Runtime and model are yours to pick.",
        executedByDisplayName: nil,
        id: "action-pending",
        name: "Orbit",
        proposedComputerID: "computer_1",
        requiredComputerID: nil,
        status: .pending
    )

    public static let executedAgentProposal = PreparedCreateAgentActionPresentation(
        avatarURL: nil,
        chatID: "product",
        computerDetail: "Mac mini (suggested)",
        createdAgentID: "agent-marlow",
        createdAt: .now.addingTimeInterval(-600),
        description: "Docs steward. Keeps the manual honest.",
        draftHint: "Give Marlow read access to #product first.",
        executedAt: .now.addingTimeInterval(-540),
        executedByDisplayName: "Zach Knickerbocker",
        id: "action-executed",
        name: "Marlow",
        proposedComputerID: "computer_1",
        requiredComputerID: nil,
        status: .executed
    )
}
