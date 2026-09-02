import Foundation

/// Splits a message's stored Markdown into plain text and typed references.
///
/// The persisted link is the source of truth: `[@Cove](agent://agt_cove)`,
/// `[@Ada](user://usr_ada)`, `[#product](chat://cht_product)`. `resolve`
/// supplies the live identity, and the persisted label remains the fallback for
/// a target the app cannot currently resolve.
public enum RichMessageParser {
    // Compiled once: this parser runs per message inside hot view bodies, and
    // per-call NSRegularExpression construction dominated its cost.
    private static let referenceExpression = try? NSRegularExpression(
        pattern: #"\[([^\]]+)\]\((agent|user|chat)://([^\)]+)\)"#
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
                  let schemeRange = Range(match.range(at: 2), in: content),
                  let idRange = Range(match.range(at: 3), in: content) else { continue }
            if cursor < fullRange.lowerBound {
                segments.append(.text(String(content[cursor..<fullRange.lowerBound])))
            }
            let kind = kind(forScheme: content[schemeRange])
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

    /// A one-line preview of a message: every Markdown link — a typed rich
    /// reference or an ordinary web link — reads as its label text, and each
    /// run of whitespace becomes a single space.
    public static func oneLinePreview(_ content: String) -> String {
        let unlinked = linkExpression.map { expression in
            expression.stringByReplacingMatches(
                in: content,
                range: NSRange(content.startIndex..., in: content),
                withTemplate: "$1"
            )
        } ?? content
        return unlinked.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    // The reference grammar without its scheme constraint: previews drop every
    // link target, typed or not.
    private static let linkExpression = try? NSRegularExpression(
        pattern: #"\[([^\]]+)\]\(([^\)]+)\)"#
    )

    private static func kind(forScheme scheme: Substring) -> MentionPresentationKind {
        switch scheme {
        case "agent": .agent
        case "chat": .channel
        default: .human
        }
    }
}
