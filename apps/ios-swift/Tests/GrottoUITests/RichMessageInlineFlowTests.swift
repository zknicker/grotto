import Foundation
@testable import GrottoUI
import SwiftUI
import Testing

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// A mention is a run of the sentence: the same font, the same size, the same
/// baseline, with the capsule painted behind it. Everything asserted here is
/// what keeps that true — the runs the text engine is handed, the room the
/// capsule reserves inside them, and the line box neither may touch.
@MainActor
struct RichMessageInlineFlowTests {
    private let lead = "Can you finish the Merchbase MCP connection for"
    private let tail = ", then ping me and we can ship it today and tomorrow."

    @Test func writesTheLabelAsTextBetweenTwoSpacers() {
        let metrics = sanFrancisco(pointSize: 17)
        let body = attributedString([.text("Ping "), .reference(marlow), .text(" today.")], metrics: metrics)
        let geometry = RichReferenceCapsuleGeometry(metrics: metrics)

        // "Ping " + spacer + "Marlow" + spacer + " today.", each spacer an
        // attachment held against the label by a word joiner.
        #expect(body.string == "Ping \u{FFFC}\u{2060}Marlow\u{2060}\u{FFFC} today.")
        // And read back as the sentence it draws.
        #expect(RichMessageAttributedText.plainText(body.string) == "Ping Marlow today.")

        var referenceRange = NSRange(location: 0, length: 0)
        let run = body.attribute(
            .grottoReference,
            at: 5,
            longestEffectiveRange: &referenceRange,
            in: NSRange(location: 0, length: body.length)
        ) as? RichReferenceRun
        #expect(run?.reference == marlow)
        #expect(referenceRange == NSRange(location: 5, length: 10))

        #expect(attachmentWidth(body, at: 5) == geometry.leadingSpacer)
        #expect(attachmentWidth(body, at: 14) == geometry.trailingSpacer)
        // The spacers buy room, never height.
        #expect(attachmentBounds(body, at: 5)?.height == 0)
        #expect(attachmentBounds(body, at: 14)?.height == 0)
        // Nothing outside the reference claims to be one.
        #expect(body.attribute(.grottoReference, at: 4, effectiveRange: nil) == nil)
        #expect(body.attribute(.grottoReference, at: 15, effectiveRange: nil) == nil)
    }

    /// The defect the whole approach exists to remove: a chip that is a picture
    /// can only sit on the baseline, so its label rode above the words and its
    /// capsule had to be shrunk to the ascent to stay inside the line.
    @Test func setsAMentionOnTheSameBaselineAndSizeAsTheWords() {
        for pointSize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: pointSize)
            let body = attributedString([.text("Ping "), .reference(marlow)], metrics: metrics)
            let words = body.attribute(.font, at: 0, effectiveRange: nil) as? PlatformFont
            let label = body.attribute(.font, at: 7, effectiveRange: nil) as? PlatformFont

            #expect(words?.pointSize == pointSize)
            #expect(label?.pointSize == words?.pointSize)
            #expect(label?.ascender == words?.ascender)
            #expect(label?.descender == words?.descender)
            // No run is lifted off the paragraph's baseline.
            for index in 0..<body.length {
                #expect(body.attribute(.baselineOffset, at: index, effectiveRange: nil) == nil)
            }
        }
    }

    /// The capsule is the line's own box and nothing more, and everything
    /// inside it is a fraction of that box, so the chip scales with Dynamic
    /// Type without ever reaching past its line.
    @Test func sizesTheCapsuleToTheLinesOwnBox() {
        for pointSize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: pointSize)
            let geometry = RichReferenceCapsuleGeometry(metrics: metrics)

            #expect(geometry.height == metrics.ascent + metrics.descent)
            #expect(geometry.cornerRadius == geometry.height / 3)
            // Roughly twice the font's x-height: ~16pt inside 17pt body text.
            #expect(geometry.markSize >= metrics.xHeight * 2 * 0.85)
            #expect(geometry.markSize <= metrics.xHeight * 2 * 1.05)
            // The mark fills what the insets leave, and nothing spills out.
            #expect(abs(geometry.markSize + geometry.leadingInset * 2 - geometry.height) < 0.001)
            #expect(geometry.leadingInset > 0)
            #expect(geometry.markGap > geometry.leadingInset)
            // Trailing padding stays under a word space so punctuation hugs the capsule.
            #expect(geometry.trailingInset > geometry.leadingInset)
            #expect(geometry.trailingInset < geometry.markGap)
        }
    }

    /// The capsule hangs off the baseline, and the mark is centered on the
    /// capsule — the two placements the renderer asks this geometry for.
    @Test func anchorsTheCapsuleToTheBaselineAndCentersTheMark() {
        for pointSize in Self.bodyPointSizes {
            let metrics = sanFrancisco(pointSize: pointSize)
            let geometry = RichReferenceCapsuleGeometry(metrics: metrics)
            let capsule = geometry.capsuleRect(leadingX: 12, baselineY: 40, width: 90)

            #expect(capsule.minY == 40 - metrics.ascent)
            #expect(abs(capsule.maxY - (40 + metrics.descent)) < 0.001)
            #expect(capsule.minX == 12)
            #expect(capsule.width == 90)

            let mark = geometry.markRect(in: capsule)
            #expect(mark.minX == capsule.minX + geometry.leadingInset)
            #expect(abs(mark.midY - capsule.midY) < 0.001)
            #expect(mark.width == geometry.markSize)
            #expect(mark.height == geometry.markSize)
            // The mark and the label both clear the capsule's edges.
            #expect(mark.minY > capsule.minY)
            #expect(mark.maxX + geometry.markGap < capsule.maxX)
        }
    }

    /// The claim measured rather than reasoned about: a wrapped paragraph
    /// carrying a mention lays out to the same line height, and the same number
    /// of lines, as the same paragraph with the label as plain words.
    @Test func laysOutAMentionWithoutChangingTheLine() {
        let metrics = PlatformTextMetrics.metrics(for: .body, dynamicTypeSize: .large)
        let font = PlatformTextMetrics.font(for: .body, dynamicTypeSize: .large)
        let mentioned = attributedString(
            [.text(lead + " "), .reference(marlow), .text(tail)],
            metrics: metrics,
            font: font
        )
        let plain = attributedString(
            [.text(lead + " " + marlow.label + tail)],
            metrics: metrics,
            font: font
        )

        let mentionedLines = lineHeights(mentioned, width: 280)
        let plainLines = lineHeights(plain, width: 280)

        #expect(!plainLines.isEmpty)
        #expect(mentionedLines.count == plainLines.count)
        for (mentionedHeight, plainHeight) in zip(mentionedLines, plainLines) {
            #expect(abs(mentionedHeight - plainHeight) < 0.001)
        }
    }

    /// Bold Text is an accessibility setting, not a chip decoration: it has to
    /// reach the body's own words, or the sentence stays regular around a bold
    /// label while every SwiftUI string beside it goes heavy.
    @Test func setsTheBodysWordsInABoldFaceWhenBoldTextIsOn() {
        let regular = PlatformTextMetrics.font(
            for: .body,
            dynamicTypeSize: .large,
            legibilityWeight: .regular
        )
        let bold = PlatformTextMetrics.font(
            for: .body,
            dynamicTypeSize: .large,
            legibilityWeight: .bold
        )

        #expect(bold != regular)
        #expect(bold.pointSize == regular.pointSize)
        #if canImport(UIKit)
        #expect(bold.fontDescriptor.symbolicTraits.contains(.traitBold))
        #else
        #expect(bold.fontDescriptor.symbolicTraits.contains(.bold))
        #endif

        // And the body run the text engine is handed is set in it.
        let body = RichMessageAttributedText.make(
            segments: [.text("Ping "), .reference(marlow)],
            textStyle: .body,
            dynamicTypeSize: .large,
            legibilityWeight: .bold
        )
        #expect((body.attribute(.font, at: 0, effectiveRange: nil) as? PlatformFont) == bold)
    }

    /// The label is the name itself. Its spaces and hyphens used to be sealed
    /// shut with non-breaking spaces and word joiners, which made a long label
    /// one token wider than the column at an accessibility size and left the
    /// engine no way to wrap it but by character. Only the two joiners holding
    /// each spacer against the label remain.
    @Test func writesAHyphenatedLabelVerbatimBetweenItsSpacers() {
        let label = "Jean-Luc / Ops"
        let body = attributedString(
            [.reference(
                RichReferencePresentation(
                    id: "hum_jean_luc",
                    kind: .human,
                    label: label,
                    avatarURL: nil
                )
            )],
            metrics: sanFrancisco(pointSize: 17)
        )

        #expect(body.string == "\u{FFFC}\u{2060}Jean-Luc / Ops\u{2060}\u{FFFC}")
        #expect(!body.string.contains("\u{00A0}"))
        // Two joiners, one per spacer, and none inside the label.
        #expect(body.string.filter { $0 == "\u{2060}" }.count == 2)
        // And a copy of it still reads as the label itself.
        #expect(RichMessageAttributedText.plainText(body.string) == label)
    }

    /// A default body size and the size an accessibility setting reaches.
    private static let bodyPointSizes: [CGFloat] = [17, 40]

    /// SF's vertical metrics at a point size, as UIKit reports them: no
    /// leading, and ascent, descent, cap height, and x-height in fixed
    /// proportion to the size. The geometry is asked for numbers, not for a
    /// platform, so driving it from these exercises it at two genuinely
    /// different sizes wherever these tests run.
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

    private var marlow: RichReferencePresentation {
        RichReferencePresentation(id: "agt_marlow", kind: .agent, label: "Marlow", avatarURL: nil)
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

    private func attachmentBounds(_ body: NSAttributedString, at index: Int) -> CGRect? {
        (body.attribute(.attachment, at: index, effectiveRange: nil) as? NSTextAttachment)?.bounds
    }

    private func attachmentWidth(_ body: NSAttributedString, at index: Int) -> CGFloat? {
        attachmentBounds(body, at: index)?.width
    }

    /// The used height of every line the text engine lays this body out into.
    private func lineHeights(_ body: NSAttributedString, width: CGFloat) -> [CGFloat] {
        let storage = NSTextStorage(attributedString: body)
        let layoutManager = NSLayoutManager()
        let container = NSTextContainer(
            size: CGSize(width: width, height: .greatestFiniteMagnitude)
        )
        container.lineFragmentPadding = 0
        layoutManager.addTextContainer(container)
        storage.addLayoutManager(layoutManager)
        layoutManager.ensureLayout(for: container)

        var heights: [CGFloat] = []
        layoutManager.enumerateLineFragments(
            forGlyphRange: NSRange(location: 0, length: layoutManager.numberOfGlyphs)
        ) { _, usedRect, _, _, _ in
            heights.append(usedRect.height)
        }
        return heights
    }
}
