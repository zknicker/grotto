import Foundation

public enum MentionOptionKind: String, Codable, Sendable {
    case agent
    case skill
    case user
}

public struct MentionOptionMetadata: Codable, Sendable, Equatable {
    public let userAvatarURL: String?
    public let userHandle: String?

    enum CodingKeys: String, CodingKey {
        case userAvatarURL = "userAvatarUrl"
        case userHandle
    }
}

public struct MentionOption: Codable, Identifiable, Sendable, Equatable {
    public let description: String?
    public let id: String
    public let insertText: String
    public let kind: MentionOptionKind
    public let label: String
    public let metadata: MentionOptionMetadata?
    public let projection: String
    public let sourceLabel: String
}

public struct MentionOptions: Codable, Sendable, Equatable {
    public let options: [MentionOption]
}
