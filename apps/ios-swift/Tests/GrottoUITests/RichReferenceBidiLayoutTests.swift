import CoreGraphics
import Foundation
@testable import GrottoUI
import Testing

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The rects the text engine reports for a reference run, laid out for real.
///
/// `RichReferenceRunPiece` is arithmetic on two rects; this is where those two
/// rects come from, and it is the half bidi reordering breaks. A glyph's own
/// `boundingRect` is measured to wherever the next glyph starts, which across a
/// level boundary is the neighbouring word — so the rule has to be read from
/// the geometry a selection is drawn with instead.
@MainActor
struct RichReferenceBidiLayoutTests {
    /// Left to right: the mark stands on the fragment's left edge, on the
    /// spacer, and the rule spans the label's own glyphs.
    @Test func matchesTheFragmentBoxOnALeftToRightRun() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)
        let pieces = fragments(
            body([.text("Ping "), .reference(marlow), .text(" today.")], metrics: metrics),
            width: 280,
            markSize: geometry.markSize
        )

        #expect(pieces.count == 1)
        guard let piece = pieces.first else { return }
        #expect(piece.placement.markLeadingX == piece.bounds.minX)
        #expect(piece.placement.markLeadingX == piece.spacer?.minX)
        #expect(abs(piece.placement.underlineFromX - (piece.labelHead?.minX ?? 0)) < 0.01)
        #expect(abs(piece.placement.underlineToX - piece.bounds.maxX) < 0.01)
        #expect(piece.placement.underlineToX > piece.placement.underlineFromX)
    }

    /// A Hebrew label in a paragraph that runs right to left puts the spacer at
    /// the *right* of the run, and the mark goes with it while the rule stays
    /// on the words. The room the spacer buys is not part of this — macOS
    /// TextKit 1 lays a bare `NSTextAttachment` out at a 1pt placeholder
    /// advance rather than the `bounds` UIKit honors — so what is asserted is
    /// which side each thing is anchored to.
    @Test func followsTheSpacerToTheRightOnARightToLeftRun() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)
        let pieces = fragments(
            rightToLeft(body([.text("שלום "), .reference(hebrew), .text(" תודה")], metrics: metrics)),
            width: 280,
            markSize: geometry.markSize
        )

        #expect(pieces.count == 1)
        guard let piece = pieces.first, let spacer = piece.spacer else {
            Issue.record("the right-to-left run laid out without a spacer")
            return
        }
        // The mark hangs off the spacer at the right of the run.
        #expect(abs((piece.placement.markLeadingX ?? 0) - spacer.minX) <= geometry.markSize)
        #expect((piece.placement.markLeadingX ?? 0) > piece.bounds.midX)
        // The rule stops where the spacer the mark stands in begins, and stays
        // inside the fragment on both sides.
        #expect(piece.placement.underlineToX <= spacer.minX + 0.01)
        #expect(piece.placement.underlineFromX >= piece.bounds.minX)
        #expect(piece.placement.underlineToX > piece.placement.underlineFromX)
    }

    /// The defect this file is named for. A *Latin* label inside the same
    /// right-to-left paragraph is a bidi level boundary in the middle of the
    /// run: each of its glyphs reports a box measured to the next glyph across
    /// that boundary, so unioning them ran the rule from the word before the
    /// mention, under the spacer and the mark, and into the word after it — on
    /// an iPhone 17 Pro, 631–892px under a label whose glyphs were 657–795 and
    /// a mark at 812–856. macOS TextKit 1 reproduces it, so the numbers here
    /// are the real ones rather than a stand-in: the rule is the label's own
    /// width and stops where the mark's spacer begins.
    @Test func keepsTheRuleOnALatinLabelInARightToLeftParagraph() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)
        let pieces = fragments(
            rightToLeft(body([.text("שלום "), .reference(blippy), .text(" בדוק את הכל")], metrics: metrics)),
            width: 280,
            markSize: geometry.markSize
        )

        #expect(pieces.count == 1)
        guard let piece = pieces.first, let spacer = piece.spacer, let union = piece.glyphUnion else {
            Issue.record("the right-to-left run laid out without a spacer")
            return
        }
        // The rule is as long as the words it underlines, and clear of the
        // spacer the mark is drawn in.
        let words = NSAttributedString(
            string: blippy.label,
            attributes: [.font: PlatformFont.systemFont(ofSize: metrics.pointSize)]
        )
        #expect(abs((piece.placement.underlineToX - piece.placement.underlineFromX) - words.size().width) < 3)
        #expect(piece.placement.underlineToX <= spacer.minX + 0.01)
        // Where unioning the run's own glyph rects — the derivation this
        // replaced — reached over the mark and past both neighbouring words.
        #expect(union.maxX > spacer.maxX)
        #expect(union.minX < piece.placement.underlineFromX)
        #expect(union.width > words.size().width * 1.5)
    }

    /// And the placement is read from the run's *characters*, never from the
    /// glyphs the fragment happens to hand over: under bidi the engine reorders
    /// the spacer and the neighbouring words in among the label's glyphs, so
    /// widening the fragment to the whole line must not move a dot.
    @Test func readsThePlacementFromTheRunsCharactersNotTheFragmentsGlyphs() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let markSize = RichReferenceMarkGeometry(metrics: metrics).markSize
        let text = rightToLeft(body([.text("שלום "), .reference(blippy), .text(" בדוק את הכל")], metrics: metrics))
        let run = fragments(text, width: 280, markSize: markSize)
        let line = fragments(text, width: 280, markSize: markSize, widenToLine: true)

        #expect(!run.isEmpty)
        #expect(run.map(\.placement) == line.map(\.placement))
    }

    /// A label too wide for the column breaks at its own spaces. Only the
    /// fragment holding the spacer wears the mark.
    @Test func wearsTheMarkOnlyOnTheFragmentHoldingTheSpacer() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)
        let pieces = fragments(
            body([.text("Ping "), .reference(team), .text(" today.")], metrics: metrics),
            width: 120,
            markSize: geometry.markSize
        )

        #expect(pieces.count > 1)
        #expect(pieces.filter { $0.placement.markLeadingX != nil }.count == 1)
        #expect(pieces.first?.placement.markLeadingX != nil)
        for piece in pieces.dropFirst() {
            #expect(piece.placement.markLeadingX == nil)
            #expect(abs(piece.placement.underlineFromX - piece.bounds.minX) < 0.01)
            // A fragment ending in a label space stops the rule at the words.
            #expect(piece.placement.underlineToX <= piece.bounds.maxX + 0.01)
        }
    }

    /// One fragment: the placement the renderer asks for, the box it used to
    /// derive both numbers from, where the engine put the spacer and the
    /// label's first glyph, and the union of the run's own glyph rects.
    private struct Fragment {
        let placement: RichReferenceRunPiece
        let bounds: CGRect
        let spacer: CGRect?
        /// The label's first glyph: its rightmost, running right to left.
        let labelHead: CGRect?
        /// Every label glyph's own box, unioned — right where the paragraph
        /// runs one way, and the defect where it does not.
        let glyphUnion: CGRect?
    }

    /// - Parameter widenToLine: hand the renderer every glyph on the line
    ///   rather than the run's own, as bidi reordering does on the phone.
    private func fragments(
        _ body: NSAttributedString,
        width: CGFloat,
        markSize: CGFloat,
        widenToLine: Bool = false
    ) -> [Fragment] {
        let storage = NSTextStorage(attributedString: body)
        let layoutManager = NSLayoutManager()
        let breaker = RichReferenceLineBreaker()
        layoutManager.delegate = breaker
        let container = NSTextContainer(size: CGSize(width: width, height: CGFloat.infinity))
        container.lineFragmentPadding = 0
        layoutManager.addTextContainer(container)
        storage.addLayoutManager(layoutManager)

        return withExtendedLifetime(breaker) {
            layoutManager.ensureLayout(for: container)
            let characters = runRange(in: body)
            let glyphs = layoutManager.glyphRange(forCharacterRange: characters, actualCharacterRange: nil)
            let spacer = layoutManager.referenceSpacerGlyph(inCharacterRange: characters)
            var fragments: [Fragment] = []
            layoutManager.enumerateLineFragments(forGlyphRange: glyphs) { _, _, _, lineGlyphs, _ in
                let piece = widenToLine ? lineGlyphs : NSIntersectionRange(glyphs, lineGlyphs)
                guard NSIntersectionRange(glyphs, piece).length > 0 else { return }
                let held = spacer.flatMap { NSLocationInRange($0, piece) ? $0 : nil }
                fragments.append(
                    Fragment(
                        placement: layoutManager.referenceRunPiece(
                            glyphs: piece,
                            characters: characters,
                            spacerGlyph: spacer,
                            markSize: markSize,
                            in: container
                        ),
                        bounds: layoutManager.boundingRect(forGlyphRange: piece, in: container),
                        spacer: held.map {
                            layoutManager.boundingRect(forGlyphRange: NSRange(location: $0, length: 1), in: container)
                        },
                        // The spacer is an attachment and a word joiner, so the
                        // label's first glyph is two past it.
                        labelHead: held.map {
                            layoutManager.boundingRect(
                                forGlyphRange: NSRange(location: $0 + 2, length: 1),
                                in: container
                            )
                        },
                        glyphUnion: glyphUnion(
                            layoutManager,
                            glyphs: NSIntersectionRange(glyphs, piece),
                            label: characters,
                            in: container
                        )
                    )
                )
            }
            return fragments
        }
    }

    /// Every label glyph's own box, unioned one glyph at a time — the spacer
    /// and its joiner, the run's first two characters, left out.
    private func glyphUnion(
        _ layoutManager: NSLayoutManager,
        glyphs: NSRange,
        label run: NSRange,
        in container: NSTextContainer
    ) -> CGRect? {
        var union: CGRect?
        for glyph in glyphs.location..<glyphs.upperBound {
            let character = layoutManager.characterIndexForGlyph(at: glyph)
            guard NSLocationInRange(character, run), character > run.location + 1 else { continue }
            let rect = layoutManager.boundingRect(forGlyphRange: NSRange(location: glyph, length: 1), in: container)
            union = union.map { $0.union(rect) } ?? rect
        }
        return union
    }

    /// The first reference run, spacer and all.
    private func runRange(in body: NSAttributedString) -> NSRange {
        var run = NSRange(location: 0, length: 0)
        let whole = NSRange(location: 0, length: body.length)
        body.enumerateAttribute(.grottoReference, in: whole) { value, range, stop in
            guard value != nil else { return }
            run = range
            stop.pointee = true
        }
        return run
    }

    private func body(_ segments: [RichMessageSegment], metrics: PlatformFontMetrics) -> NSAttributedString {
        RichMessageAttributedText.make(
            segments: segments,
            font: PlatformFont.systemFont(ofSize: metrics.pointSize),
            metrics: metrics
        )
    }

    /// The same body in a paragraph whose base direction runs right to left.
    private func rightToLeft(_ body: NSAttributedString) -> NSAttributedString {
        let directed = NSMutableAttributedString(attributedString: body)
        let paragraph = NSMutableParagraphStyle()
        paragraph.baseWritingDirection = .rightToLeft
        let whole = NSRange(location: 0, length: directed.length)
        directed.addAttribute(.paragraphStyle, value: paragraph, range: whole)
        return directed
    }

    private let marlow = reference(id: "usr_marlow", kind: .human, label: "Marlow")
    private let team = reference(id: "chn_design", kind: .channel, label: "Product Design Team")
    private let hebrew = reference(id: "chn_shalom", kind: .channel, label: "צוות עיצוב")
    private let blippy = reference(id: "agt_blippy", kind: .agent, label: "Blippy")

    private static func reference(
        id: String,
        kind: MentionPresentationKind,
        label: String
    ) -> RichReferencePresentation {
        RichReferencePresentation(id: id, kind: kind, label: label, avatarURL: nil)
    }
}
