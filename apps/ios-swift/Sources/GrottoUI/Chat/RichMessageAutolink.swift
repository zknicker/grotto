import Foundation

/// Bare web addresses written in prose.
///
/// The App renders message Markdown with `remark-gfm`, which turns a bare
/// `https://…` into a link before the reference renderer ever sees it — so a
/// pasted address wears the same chip there as a written `[text](url)` link.
/// This is that rule for the phone, kept to the one form both clients agree on:
/// an explicit `http` or `https` address. A `www.` prefix or an email address
/// is left as prose here, which the mentions doc records as a known difference.
enum RichMessageAutolink {
    /// Every bare address in `text`, in order, with the trailing punctuation
    /// that belongs to the sentence rather than the address trimmed off.
    static func urls(in text: Substring) -> [Range<String.Index>] {
        guard let expression else { return [] }
        let full = String(text)
        return expression
            .matches(in: full, range: NSRange(full.startIndex..., in: full))
            .compactMap { match in
                guard let matched = Range(match.range(at: 1), in: full) else { return nil }
                let trimmed = trimmingSentencePunctuation(full[matched])
                guard !trimmed.isEmpty else { return nil }
                return offset(trimmed, from: full, into: text)
            }
    }

    /// A sentence's own punctuation is not part of the address, and a closing
    /// parenthesis belongs to the address only when the address opened one.
    private static func trimmingSentencePunctuation(_ url: Substring) -> Substring {
        var value = url
        while let last = value.last {
            if last == ")" {
                let opens = value.filter { $0 == "(" }.count
                let closes = value.filter { $0 == ")" }.count
                guard closes > opens else { break }
            } else if !trailingPunctuation.contains(last) {
                break
            }
            value = value.dropLast()
        }
        return value
    }

    /// The match ran against a copy, so its indices are mapped back onto the
    /// caller's own slice.
    private static func offset(
        _ matched: Substring,
        from full: String,
        into text: Substring
    ) -> Range<String.Index> {
        let start = full.distance(from: full.startIndex, to: matched.startIndex)
        let lower = text.index(text.startIndex, offsetBy: start)
        let upper = text.index(lower, offsetBy: matched.count)
        return lower..<upper
    }

    // An address opens a word: at the start of the text, or after whitespace or
    // one of the emphasis and bracket characters Markdown allows in front of a
    // link.
    private static let expression = try? NSRegularExpression(
        pattern: #"(?:^|[\s*_~(\[])(https?://[^\s<>\"\]]+)"#
    )
    private static let trailingPunctuation: Set<Character> = [
        ".", ",", ":", ";", "!", "?", "'", "\"", "*", "_", "~",
    ]
}
