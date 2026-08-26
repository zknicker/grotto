import Foundation

public enum MentionPresentationKind: Hashable, Sendable {
    case agent
    case human
}

public struct MentionOptionPresentation: Identifiable, Hashable, Sendable {
    public let id: String
    public let insertText: String
    public let label: String
    public let detail: String?
    public let kind: MentionPresentationKind
    public let avatarURL: URL?

    public init(
        id: String,
        insertText: String,
        label: String,
        detail: String?,
        kind: MentionPresentationKind,
        avatarURL: URL?
    ) {
        self.id = id
        self.insertText = insertText
        self.label = label
        self.detail = detail
        self.kind = kind
        self.avatarURL = avatarURL
    }
}

public struct ComposerMentionQuery: Equatable, Sendable {
    public let range: Range<String.Index>
    public let value: String

    public static func active(in text: String) -> ComposerMentionQuery? {
        guard let at = text.lastIndex(of: "@"),
              at == text.startIndex || text[text.index(before: at)].isWhitespace else {
            return nil
        }
        let valueStart = text.index(after: at)
        let value = String(text[valueStart...])
        guard !value.contains(where: \.isNewline), value.count <= 80 else { return nil }
        return ComposerMentionQuery(range: at..<text.endIndex, value: value)
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

    public init(id: String, kind: MentionPresentationKind, label: String, avatarURL: URL?) {
        self.id = id
        self.kind = kind
        self.label = label
        self.avatarURL = avatarURL
    }
}

public enum RichMessageParser {
    // Compiled once: this parser runs per message inside hot view bodies, and
    // per-call NSRegularExpression construction dominated its cost.
    private static let referenceExpression = try? NSRegularExpression(
        pattern: #"\[([^\]]+)\]\((agent|user)://([^\)]+)\)"#
    )

    public static func parse(
        _ content: String,
        resolve: (MentionPresentationKind, String, String) -> RichReferencePresentation?
    ) -> [RichMessageSegment] {
        guard let expression = referenceExpression else {
            return [.text(content)]
        }
        let range = NSRange(content.startIndex..., in: content)
        var cursor = content.startIndex
        var segments: [RichMessageSegment] = []

        for match in expression.matches(in: content, range: range) {
            guard let fullRange = Range(match.range(at: 0), in: content),
                  let labelRange = Range(match.range(at: 1), in: content),
                  let kindRange = Range(match.range(at: 2), in: content),
                  let idRange = Range(match.range(at: 3), in: content) else { continue }
            if cursor < fullRange.lowerBound {
                segments.append(.text(String(content[cursor..<fullRange.lowerBound])))
            }
            let kind: MentionPresentationKind = content[kindRange] == "agent" ? .agent : .human
            let id = String(content[idRange]).removingPercentEncoding ?? String(content[idRange])
            let fallback = String(content[labelRange])
            segments.append(
                .reference(
                    resolve(kind, id, fallback)
                        ?? RichReferencePresentation(
                            id: id,
                            kind: kind,
                            label: fallback,
                            avatarURL: nil
                        )
                )
            )
            cursor = fullRange.upperBound
        }

        if cursor < content.endIndex {
            segments.append(.text(String(content[cursor...])))
        }
        return segments.isEmpty ? [.text(content)] : segments
    }
}
