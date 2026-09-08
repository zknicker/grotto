import Foundation

/// One piece of a message body: prose, or a ```visual fence.
public enum VisualFenceSegment: Sendable, Hashable {
    case text(String)
    case visual(html: String, isOpen: Bool, title: String?)
}

/// One visual fence in a message, identified by its 1-based ordinal.
public struct VisualSegment: Sendable, Hashable, Identifiable {
    public let ordinal: Int
    public let html: String
    public let isOpen: Bool
    public let title: String?

    public var id: Int { ordinal }

    public init(ordinal: Int, html: String, isOpen: Bool, title: String?) {
        self.ordinal = ordinal
        self.html = html
        self.isOpen = isOpen
        self.title = title
    }
}

/// A message body split into the prose it says and the visuals it draws.
public struct VisualMessageBody: Sendable, Hashable {
    public let prose: String
    public let visuals: [VisualSegment]

    public init(prose: String, visuals: [VisualSegment]) {
        self.prose = prose
        self.visuals = visuals
    }
}

/// The ```visual fence grammar, ported from `packages/grotto-api/src/widgets/
/// visual/contracts.ts`. An optional info-string title follows the tag, then the
/// raw HTML body up to the closing fence; a trailing unclosed fence is a
/// mid-stream visual whose body is still growing.
public enum VisualFence {
    /// The web's `splitVisualFences`, segment for segment.
    public static func split(_ content: String) -> [VisualFenceSegment] {
        guard let closed = closedExpression, let open = openExpression else {
            return content.isEmpty ? [] : [.text(content)]
        }
        let source = content as NSString
        var segments: [VisualFenceSegment] = []
        var cursor = 0

        for match in closed.matches(in: content, range: NSRange(location: 0, length: source.length)) {
            let index = match.range.location
            if index > cursor {
                segments.append(
                    .text(source.substring(with: NSRange(location: cursor, length: index - cursor)))
                )
            }
            segments.append(
                visual(
                    title: capture(match, at: 1, in: source),
                    html: capture(match, at: 2, in: source),
                    isOpen: false
                )
            )
            cursor = index + match.range.length
        }

        // Only the tail past the last closed fence can hold an unclosed fence.
        let tail = source.substring(from: cursor) as NSString
        let tailRange = NSRange(location: 0, length: tail.length)

        if let opened = open.firstMatch(in: tail as String, range: tailRange) {
            if opened.range.location > 0 {
                segments.append(.text(tail.substring(to: opened.range.location)))
            }
            segments.append(
                visual(
                    title: capture(opened, at: 1, in: tail),
                    html: capture(opened, at: 2, in: tail),
                    isOpen: true
                )
            )
        } else if tail.length > 0 {
            segments.append(.text(tail as String))
        }

        return segments
    }

    /// The web's transcript placement: every text segment concatenated in order
    /// and trimmed as one prose block, then the fences in order.
    public static func body(_ content: String) -> VisualMessageBody {
        var prose = ""
        var visuals: [VisualSegment] = []

        for segment in split(content) {
            switch segment {
            case let .text(text):
                prose += text
            case let .visual(html, isOpen, title):
                visuals.append(
                    VisualSegment(ordinal: visuals.count + 1, html: html, isOpen: isOpen, title: title)
                )
            }
        }

        return VisualMessageBody(
            prose: prose.trimmingCharacters(in: .whitespacesAndNewlines),
            visuals: visuals
        )
    }

    /// The web's `visualFallbackText`: explicit title, else the document
    /// `<title>`, else the first h1-h3 text, else "Visual".
    public static func fallbackText(html: String, title: String?) -> String {
        let trimmed = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty {
            return String(trimmed.prefix(fallbackTextLimit))
        }
        if let documentTitle = tagText(html, matching: titleExpression) {
            return documentTitle
        }
        return tagText(html, matching: headingExpression) ?? "Visual"
    }

    /// Message content with every visual fence collapsed to its fallback text,
    /// so a one-line preview reads the visual's name instead of its markup.
    public static func previewText(_ content: String) -> String {
        let segments = split(content)
        guard segments.contains(where: { if case .visual = $0 { return true } else { return false } })
        else {
            return content
        }
        return segments.map { segment in
            switch segment {
            case let .text(text):
                text
            case let .visual(html, _, title):
                fallbackText(html: html, title: title)
            }
        }.joined()
    }

    private static let fallbackTextLimit = 500

    // Ported verbatim from the web contract. `[\s\S]` stays literal — the
    // patterns rely on `.` remaining line-bounded, so no dot-matches-newlines.
    private static let closedExpression = try? NSRegularExpression(
        pattern: #"^```visual(?:[ \t]+([^\n]*?))?[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*$"#,
        options: [.anchorsMatchLines]
    )

    private static let openExpression = try? NSRegularExpression(
        pattern: #"^```visual(?:[ \t]+([^\n]*?))?[ \t]*(?:\n([\s\S]*))?$"#,
        options: [.anchorsMatchLines]
    )

    private static let titleExpression = try? NSRegularExpression(
        pattern: #"<title[^>]*>([\s\S]*?)</title>"#,
        options: [.caseInsensitive]
    )

    private static let headingExpression = try? NSRegularExpression(
        pattern: #"<h[1-3][^>]*>([\s\S]*?)</h[1-3]>"#,
        options: [.caseInsensitive]
    )

    private static func visual(title: String, html: String, isOpen: Bool) -> VisualFenceSegment {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return .visual(html: html, isOpen: isOpen, title: trimmed.isEmpty ? nil : trimmed)
    }

    // A capture group that did not participate reads as the empty string, the
    // way JavaScript's `match[n] ?? ''` does.
    private static func capture(
        _ match: NSTextCheckingResult,
        at index: Int,
        in source: NSString
    ) -> String {
        let range = match.range(at: index)
        guard range.location != NSNotFound else { return "" }
        return source.substring(with: range)
    }

    private static func tagText(_ html: String, matching expression: NSRegularExpression?) -> String? {
        guard let expression else { return nil }
        let source = html as NSString
        guard
            let match = expression.firstMatch(
                in: html,
                range: NSRange(location: 0, length: source.length)
            ),
            match.range(at: 1).location != NSNotFound
        else {
            return nil
        }
        let inner = source.substring(with: match.range(at: 1))
        guard !inner.isEmpty else { return nil }

        let text = inner
            .replacingOccurrences(of: "<[^>]*>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : String(text.prefix(fallbackTextLimit))
    }
}
