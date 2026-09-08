import Foundation

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
