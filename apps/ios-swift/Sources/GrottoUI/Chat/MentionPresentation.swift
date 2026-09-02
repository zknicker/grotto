import Foundation

public enum MentionPresentationKind: Hashable, Sendable {
    case agent
    case channel
    case human
}

public struct MentionOptionPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let insertText: String
    public let label: String
    public let detail: String?
    public let kind: MentionPresentationKind
    public let avatarURL: URL?
    /// A channel option's live appearance. Nil for every other kind.
    public let channelAppearance: ChannelAppearance?

    public init(
        id: String,
        insertText: String,
        label: String,
        detail: String?,
        kind: MentionPresentationKind,
        avatarURL: URL?,
        channelAppearance: ChannelAppearance? = nil
    ) {
        self.id = id
        self.insertText = insertText
        self.label = label
        self.detail = detail
        self.kind = kind
        self.avatarURL = avatarURL
        self.channelAppearance = channelAppearance
    }
}

/// The autocomplete the composer is currently offering. `@` addresses Agents
/// and humans; `#` addresses channels. Both triggers read the same way: the
/// last one that opens a word, and everything typed after it.
public struct ComposerMentionQuery: Equatable, Sendable {
    public let trigger: Character
    public let range: Range<String.Index>
    public let value: String

    public static func active(in text: String) -> ComposerMentionQuery? {
        var index = text.endIndex
        while index > text.startIndex {
            index = text.index(before: index)
            let trigger = text[index]
            guard trigger == "@" || trigger == "#" else { continue }
            // A sigil inside a word — `issue#3` — is text, not a query.
            guard index == text.startIndex || text[text.index(before: index)].isWhitespace else {
                continue
            }
            let value = String(text[text.index(after: index)...])
            guard !value.contains(where: \.isNewline), value.count <= 80 else { return nil }
            return ComposerMentionQuery(trigger: trigger, range: index..<text.endIndex, value: value)
        }
        return nil
    }

    public func inserting(_ option: MentionOptionPresentation, into text: String) -> String {
        text.replacingCharacters(
            in: range,
            with: "[\(option.insertText)](\(option.id)) "
        )
    }
}

public enum RichMessageSegment: Hashable, Sendable {
    case text(String)
    case reference(RichReferencePresentation)
}

public struct RichReferencePresentation: Hashable, Sendable {
    public let id: String
    public let kind: MentionPresentationKind
    public let label: String
    public let avatarURL: URL?
    /// A channel reference's live appearance. Nil for every other kind, and
    /// nil for a channel the app cannot currently resolve.
    public let channelAppearance: ChannelAppearance?

    public init(
        id: String,
        kind: MentionPresentationKind,
        label: String,
        avatarURL: URL?,
        channelAppearance: ChannelAppearance? = nil
    ) {
        self.id = id
        self.kind = kind
        self.label = label
        self.avatarURL = avatarURL
        self.channelAppearance = channelAppearance
    }
}
