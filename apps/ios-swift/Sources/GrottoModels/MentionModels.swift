import Foundation

public enum MentionOptionKind: String, Codable, Sendable {
    case agent
    case chat
    case skill
    case user
}

public struct MentionOptionMetadata: Codable, Sendable, Equatable {
    /// A chat option's channel appearance preset id, for example `violet`.
    public let chatColor: String?
    /// A chat option's channel glyph, a curated hugeicons export name.
    public let chatIcon: String?
    /// A skill option's own description, the sentence its library entry carries.
    public let description: String?
    public let userAvatarURL: String?
    public let userHandle: String?

    enum CodingKeys: String, CodingKey {
        case chatColor
        case chatIcon
        case description
        case userAvatarURL = "userAvatarUrl"
        case userHandle
    }
}

public struct MentionOption: Codable, Identifiable, Sendable, Equatable {
    public let description: String?
    public let id: String
    public let insertText: String
    /// Nil for a kind this client does not model. The Server may offer a kind
    /// this build has never heard of, and one such row must not cost the whole
    /// roster its decode, so an unreadable kind drops the single option.
    public let kind: MentionOptionKind?
    public let label: String
    public let metadata: MentionOptionMetadata?
    public let projection: String
    public let sourceLabel: String

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        id = try container.decode(String.self, forKey: .id)
        insertText = try container.decode(String.self, forKey: .insertText)
        kind = try? container.decode(MentionOptionKind.self, forKey: .kind)
        label = try container.decode(String.self, forKey: .label)
        metadata = try container.decodeIfPresent(MentionOptionMetadata.self, forKey: .metadata)
        projection = try container.decode(String.self, forKey: .projection)
        sourceLabel = try container.decode(String.self, forKey: .sourceLabel)
    }
}

public struct MentionOptions: Codable, Sendable, Equatable {
    public let options: [MentionOption]
}
