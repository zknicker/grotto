import Foundation

/// How a reference reads once it is on screen.
///
/// A reference is drawn with its identity mark, so the `@` or `#` the Markdown
/// carries is redundant ink. The stored channel name is a slug — `#` plus the
/// route the Server owns — and a chip shows the channel the way a person says
/// it: `onboarding-owner` reads as `Onboarding Owner`. The persisted Markdown
/// and the inserted reference target are untouched; this is presentation only.
public enum ReferenceLabel {
    /// The on-screen label for a reference of `kind`, from either a resolved
    /// identity or the persisted Markdown label.
    public static func display(_ label: String, kind: MentionPresentationKind) -> String {
        let bare = strippingSigil(label)
        return kind == .channel ? channelTitle(bare) : bare
    }

    /// A channel's stored name read as a title: dashes and underscores become
    /// spaces and each word opens in upper case. A word that already opens in
    /// upper case is left alone, so `GTM-notes` stays `GTM Notes`.
    public static func channelTitle(_ name: String) -> String {
        strippingSigil(name)
            .split(whereSeparator: { $0 == "-" || $0 == "_" || $0.isWhitespace })
            .map(capitalizingFirst)
            .joined(separator: " ")
    }

    /// The label without the `@` or `#` the Markdown carries.
    public static func strippingSigil(_ label: String) -> String {
        var value = Substring(label)
        while let first = value.first, first == "@" || first == "#" {
            value = value.dropFirst()
        }
        return String(value)
    }

    private static func capitalizingFirst(_ word: Substring) -> String {
        guard let first = word.first, first.isLowercase else { return String(word) }
        return first.uppercased() + word.dropFirst()
    }
}
