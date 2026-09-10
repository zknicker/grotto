import Foundation
@testable import HausUI
import SwiftUI
import Testing

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// A mention is a run of the sentence: the same font, the same size, the same
/// baseline, with the mark painted before it and the dotted rule under it.
/// Everything asserted here is what keeps that true — the runs the text engine
/// is handed, the room the mark reserves inside them, and the line box neither
/// the mark nor the rule may touch.
@MainActor
struct RichMessageInlineFlowTests {
    private let lead = "Can you finish the Merchbase MCP connection for"
    private let tail = ", then ping me and we can ship it today and tomorrow."

    @Test func writesTheLabelAsTextAfterOneSpacer() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let body = attributedString([.text("Ping "), .reference(marlow), .text(" today.")], metrics: metrics)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)

        // "Ping " + spacer + "Marlow" + " today.": one spacer, before the
        // label, held against it by a word joiner. The App's chip carries no
        // padding, so nothing is bought after the words.
        #expect(body.string == "Ping \u{FFFC}\u{2060}Marlow today.")
        // And read back as the sentence it draws.
        #expect(RichMessageAttributedText.plainText(body.string) == "Ping Marlow today.")

        var referenceRange = NSRange(location: 0, length: 0)
        let run = body.attribute(
            .hausReference,
            at: 5,
            longestEffectiveRange: &referenceRange,
            in: NSRange(location: 0, length: body.length)
        ) as? RichReferenceRun
        #expect(run?.reference == marlow)
        #expect(referenceRange == NSRange(location: 5, length: 8))

        #expect(attachmentWidth(body, at: 5) == geometry.leadingSpacer)
        // The spacer buys room, never height.
        #expect(attachmentBounds(body, at: 5)?.height == 0)
        // The space before "today" is the sentence's own, outside the run.
        #expect(body.attribute(.attachment, at: 13, effectiveRange: nil) == nil)
        // Nothing outside the reference claims to be one.
        #expect(body.attribute(.hausReference, at: 4, effectiveRange: nil) == nil)
        #expect(body.attribute(.hausReference, at: 13, effectiveRange: nil) == nil)

        // And punctuation after a mention hugs the label, the way it hugs any
        // other word: there is nothing between them to advance the line.
        let punctuated = attributedString([.reference(marlow), .text(", ping me.")], metrics: metrics)
        #expect(punctuated.string == "\u{FFFC}\u{2060}Marlow, ping me.")
    }

    /// The defect the whole approach exists to remove: a chip that is a picture
    /// can only sit on the baseline, so its label rode above the words and its
    /// capsule had to be shrunk to the ascent to stay inside the line.
    @Test func setsAMentionOnTheSameBaselineAndSizeAsTheWords() {
        for pointSize in RichReferenceMetricsFixture.bodyPointSizes {
            let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: pointSize)
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
    /// engine no way to wrap it but by character. Only the joiner holding the
    /// spacer against the label remains.
    @Test func writesAHyphenatedLabelVerbatimAfterItsSpacer() {
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
            metrics: RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        )

        #expect(body.string == "\u{FFFC}\u{2060}Jean-Luc / Ops")
        #expect(!body.string.contains("\u{00A0}"))
        // One joiner, holding the label against its spacer, and none inside it.
        #expect(body.string.filter { $0 == "\u{2060}" }.count == 1)
        // And a copy of it still reads as the label itself.
        #expect(RichMessageAttributedText.plainText(body.string) == label)
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
