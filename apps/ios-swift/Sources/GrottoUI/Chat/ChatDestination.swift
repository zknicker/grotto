import Foundation

public struct HumanPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let handle: String?
    public let avatarURL: URL?

    public init(id: String, name: String, handle: String?, avatarURL: URL?) {
        self.id = id
        self.name = name
        self.handle = handle
        self.avatarURL = avatarURL
    }
}

/// Navigation is broader than persistence: an Agent can be opened before its
/// pairwise Chat exists. Only `durableChat` carries a Server Chat id.
public enum ChatDestination: Identifiable, Hashable, Sendable {
    case durableChat(ChatPresentation)
    case implicitAgentDM(AgentPresentation)

    public enum ID: Hashable, Sendable {
        case chat(String)
        case agentDM(String)
    }

    public var id: ID {
        switch self {
        case .durableChat(let chat): .chat(chat.id)
        case .implicitAgentDM(let agent): .agentDM(agent.id)
        }
    }

    public var title: String {
        switch self {
        case .durableChat(let chat): chat.title
        case .implicitAgentDM(let agent): agent.name
        }
    }

    public var kind: ChatKind {
        switch self {
        case .durableChat(let chat): chat.kind
        case .implicitAgentDM(let agent): .agentDirectMessage(agent)
        }
    }

    public var unreadCount: Int {
        switch self {
        case .durableChat(let chat): chat.unreadCount
        case .implicitAgentDM: 0
        }
    }

    public var appearance: ChannelAppearance {
        switch self {
        case .durableChat(let chat): chat.appearance
        case .implicitAgentDM: .default
        }
    }

    public var durableChat: ChatPresentation? {
        guard case .durableChat(let chat) = self else { return nil }
        return chat
    }

    public var pendingKey: String {
        switch id {
        case .chat(let id): id
        case .agentDM(let id): "agent-dm:\(id)"
        }
    }
}

/// The last-open Chat survives launches as a defaults string, so the app opens
/// into the conversation the user left rather than the top of the Chat list.
/// A stored id the Server list no longer carries falls back to the first Chat
/// through the shell's ordinary selection sync.
extension ChatDestination.ID {
    public static let lastOpenDefaultsKey = "lastOpenChatDestination"

    public var storageValue: String {
        switch self {
        case .chat(let id): "chat:\(id)"
        case .agentDM(let id): "agentDM:\(id)"
        }
    }

    public init?(storageValue: String) {
        if storageValue.hasPrefix("chat:") {
            self = .chat(String(storageValue.dropFirst("chat:".count)))
        } else if storageValue.hasPrefix("agentDM:") {
            self = .agentDM(String(storageValue.dropFirst("agentDM:".count)))
        } else {
            return nil
        }
    }
}
