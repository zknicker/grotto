import Foundation
@testable import GrottoUI
import SwiftUI
import Testing

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// A label wears one capsule, so its words belong together — until together
/// stops being possible. These are the two halves of that: the policy that
/// decides a break opportunity, and the layout it produces once
/// `RichReferenceLineBreaker` is the layout manager's delegate.
@MainActor
struct RichReferenceLineBreakingTests {
    /// A lead long enough to run the mention up against the end of a 280pt
    /// line, and a tail to wrap past it.
    private let lead = "Can you finish the Merchbase MCP connection for"
    private let tail = ", then ping me and we can ship it today and tomorrow."

    /// The break policy itself: a run that fits on a line is never opened, a
    /// run too wide for any line may break at its own word boundaries, and a
    /// break before the run is how a mention moves whole to the next line.
    @Test func refusesToBreakInsideAMentionThatFitsOnALine() {
        let run = NSRange(location: 10, length: 20)

        #expect(
            RichReferenceLineBreaking.shouldBreakByWord(
                at: 15, runRange: run, runWidth: 180, containerWidth: 280
            ) == false
        )
        #expect(
            RichReferenceLineBreaking.shouldBreakByWord(
                at: 15, runRange: run, runWidth: 320, containerWidth: 280
            ) == true
        )
        // The run's own first character: the break that moves it whole.
        #expect(
            RichReferenceLineBreaking.shouldBreakByWord(
                at: 10, runRange: run, runWidth: 180, containerWidth: 280
            ) == true
        )
        // Ordinary words are the engine's business, not ours.
        #expect(
            RichReferenceLineBreaking.shouldBreakByWord(
                at: 4, runRange: nil, runWidth: 0, containerWidth: 280
            ) == true
        )
        // First layout, before the container carries the row's width.
        #expect(
            RichReferenceLineBreaking.shouldBreakByWord(
                at: 15, runRange: run, runWidth: 320, containerWidth: 0
            ) == false
        )
        // A name is never hyphenated, however little room is left.
        #expect(
            RichReferenceLineBreaking.shouldBreakByHyphenating(at: 15, runRange: run) == false
        )
        #expect(
            RichReferenceLineBreaking.shouldBreakByHyphenating(at: 15, runRange: nil) == true
        )
        #expect(RichReferenceLineBreaking.usableWidth(ofContainerWidth: 280, lineFragmentPadding: 5) == 270)
    }

    /// The defect proved on device, measured: at a column the label fits, the
    /// run lays out into one fragment; at a column it cannot fit, it breaks —
    /// but only where the label's own words end, never mid-word.
    @Test func breaksALongLabelOnlyAtItsOwnWordBoundaries() {
        let team = RichReferencePresentation(
            id: "chn_product_design",
            kind: .channel,
            label: "Product Design Team",
            avatarURL: nil
        )
        // The lead runs the mention up against the end of a 280pt line, which
        // is where the old behavior split it: the run fits on a line by
        // itself, so it moves whole rather than leaving "Product Design" above
        // "Team".
        let body = attributedString(
            [.text(lead + " "), .reference(team), .text(tail)],
            metrics: sanFrancisco(pointSize: 17),
            font: PlatformFont.systemFont(ofSize: 17)
        )
        let label = labelRange(in: body)

        #expect(labelFragments(body, width: 280, labelRange: label) == [0..<label.length])

        // 120pt cannot hold "Product Design Team" at 17pt. The run breaks —
        // and every break lands where the label's own words end.
        let pieces = labelFragments(body, width: 120, labelRange: label)
        #expect(pieces.count > 1)
        #expect(pieces.first?.lowerBound == 0)
        #expect(pieces.last?.upperBound == label.length)
        let characters = Array(team.label)
        for piece in pieces.dropFirst() {
            let start = piece.lowerBound
            #expect(characters[start - 1] == " " || characters[start] == " ")
        }
    }

    /// The label inside the first reference run, without its spacers: an
    /// attachment and a joiner lead the run, a joiner and an attachment close
    /// it.
    private func labelRange(in body: NSAttributedString) -> NSRange {
        var run = NSRange(location: 0, length: 0)
        body.enumerateAttribute(
            .grottoReference,
            in: NSRange(location: 0, length: body.length)
        ) { value, range, stop in
            guard value != nil else { return }
            run = range
            stop.pointee = true
        }
        return NSRange(location: run.location + 2, length: run.length - 4)
    }

    /// The label's characters as the text engine splits them across line
    /// fragments, as offsets from the label's own start.
    private func labelFragments(
        _ body: NSAttributedString,
        width: CGFloat,
        labelRange: NSRange
    ) -> [Range<Int>] {
        let storage = NSTextStorage(attributedString: body)
        let layoutManager = NSLayoutManager()
        let breaker = RichReferenceLineBreaker()
        layoutManager.delegate = breaker
        let container = NSTextContainer(
            size: CGSize(width: width, height: .greatestFiniteMagnitude)
        )
        container.lineFragmentPadding = 0
        layoutManager.addTextContainer(container)
        storage.addLayoutManager(layoutManager)

        return withExtendedLifetime(breaker) {
            layoutManager.ensureLayout(for: container)
            let glyphs = layoutManager.glyphRange(
                forCharacterRange: labelRange,
                actualCharacterRange: nil
            )
            var pieces: [Range<Int>] = []
            layoutManager.enumerateLineFragments(forGlyphRange: glyphs) { _, _, _, lineGlyphs, _ in
                let piece = NSIntersectionRange(glyphs, lineGlyphs)
                guard piece.length > 0 else { return }
                let characters = layoutManager.characterRange(
                    forGlyphRange: piece,
                    actualGlyphRange: nil
                )
                let start = max(0, characters.location - labelRange.location)
                let end = min(
                    labelRange.length,
                    characters.location + characters.length - labelRange.location
                )
                guard start < end else { return }
                pieces.append(start..<end)
            }
            return pieces
        }
    }

    private func attributedString(
        _ segments: [RichMessageSegment],
        metrics: PlatformFontMetrics,
        font: PlatformFont? = nil
    ) -> NSAttributedString {
        RichMessageAttributedText.make(
            segments: segments,
            font: font ?? PlatformFont.systemFont(ofSize: metrics.pointSize),
            metrics: metrics
        )
    }

    /// SF's vertical metrics at a point size, as UIKit reports them.
    private func sanFrancisco(pointSize: CGFloat) -> PlatformFontMetrics {
        PlatformFontMetrics(
            pointSize: pointSize,
            ascent: pointSize * 0.956,
            descent: pointSize * 0.2406,
            leading: 0,
            xHeight: pointSize * 0.5273,
            capHeight: pointSize * 0.7132
        )
    }
}
