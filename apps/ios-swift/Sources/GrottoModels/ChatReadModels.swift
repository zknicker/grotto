public struct ChatReadInput: Encodable, Sendable, Equatable {
    public let chatID: String
    public let sequence: Int
    public let serverID: String

    public init(chatID: String, sequence: Int, serverID: String) {
        self.chatID = chatID
        self.sequence = sequence
        self.serverID = serverID
    }

    private enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case sequence
        case serverID = "serverId"
    }
}

public struct ChatReadReceipt: Codable, Sendable, Equatable {
    public let chatID: String
    public let eventCursor: String?
    public let sequence: Int
    public let serverID: String

    enum CodingKeys: String, CodingKey {
        case chatID = "chatId"
        case eventCursor
        case sequence
        case serverID = "serverId"
    }
}
