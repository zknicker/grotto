import CoreGraphics
import Foundation
@testable import GrottoUI
import Testing

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Where a reference's mark and its dotted rule land on one line fragment.
///
/// The mark rides the run's *leading* edge and the rule runs under the label's
/// own glyphs. Neither is the fragment's left edge: in an RTL paragraph the
/// spacer advances at the right, so a mark placed at the left lands on the
/// label's last glyphs and a rule measured off the fragment's box runs well
/// past the words on both sides.
@MainActor
struct RichReferenceRunPieceTests {
    /// Left to right: the mark stands at the spacer's left edge and the rule
    /// spans the label that follows it.
    @Test func placesTheMarkAtTheSpacersLeadingEdgeRunningLeftToRight() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 10, y: 0, width: 20, height: 20),
            label: CGRect(x: 30, y: 0, width: 100, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == 10)
        #expect(piece.underlineFromX == 30)
        #expect(piece.underlineToX == 130)
    }

    /// And that is the arithmetic the renderer used to do from the fragment's
    /// box alone, in the fixture's own geometry. Nothing moved.
    @Test func reproducesTheFragmentBoxDerivationRunningLeftToRight() {
        let geometry = RichReferenceMarkGeometry(metrics: RichReferenceMetricsFixture.sanFrancisco(pointSize: 17))
        let fragment = CGRect(x: 24, y: 0, width: 140, height: 20)
        let split = fragment.divided(atDistance: geometry.leadingSpacer, from: .minXEdge)
        let piece = RichReferenceRunPiece(
            attachment: split.slice,
            label: split.remainder,
            markSize: geometry.markSize
        )

        #expect(piece.markLeadingX == fragment.minX)
        #expect(piece.underlineFromX == fragment.minX + geometry.leadingSpacer)
        #expect(piece.underlineToX == fragment.maxX)
    }

    /// Right to left: the same spacer advances on the other side of the label,
    /// so the mark's leading edge is a mark's width back from the spacer's
    /// right side, and the rule is still the label's own extent.
    @Test func placesTheMarkAtTheSpacersLeadingEdgeRunningRightToLeft() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 130, y: 0, width: 20, height: 20),
            label: CGRect(x: 30, y: 0, width: 100, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == 134)
        #expect(piece.underlineFromX == 30)
        #expect(piece.underlineToX == 130)
        // The whole of the defect: the mark clears the label instead of
        // painting over its final glyphs.
        #expect((piece.markLeadingX ?? 0) >= piece.underlineToX)
    }

    /// A wrapped label's continuation carries no spacer: it wears the rule
    /// alone, under every glyph on that line.
    @Test func drawsNoMarkOnAFragmentWithoutTheSpacer() {
        let piece = RichReferenceRunPiece(
            attachment: nil,
            label: CGRect(x: 0, y: 0, width: 80, height: 20),
            markSize: 16
        )

        #expect(piece.markLeadingX == nil)
        #expect(piece.underlineFromX == 0)
        #expect(piece.underlineToX == 80)
    }

    /// And a fragment holding the spacer but none of the label wears the mark
    /// alone: a rule with nothing under it draws no dots.
    @Test func drawsNoRuleWithoutLabelGlyphs() {
        let piece = RichReferenceRunPiece(
            attachment: CGRect(x: 10, y: 0, width: 20, height: 20),
            label: nil,
            markSize: 16
        )

        #expect(piece.markLeadingX == 10)
        #expect(piece.underlineFromX == piece.underlineToX)
    }

    /// The same, at layout: a run laid out left to right still puts the mark on
    /// the fragment's left edge, and the rule spans the label's own glyphs.
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
        #expect(piece.placement.markLeadingX == piece.spacerX)
        #expect(piece.placement.underlineFromX == piece.labelHead?.minX)
        #expect(abs(piece.placement.underlineToX - piece.bounds.maxX) < 0.01)
        #expect(piece.placement.underlineToX > piece.placement.underlineFromX)
    }

    /// The defect, at layout: a Hebrew label in a paragraph that runs right to
    /// left puts the spacer at the *right* of the run, and the mark goes with
    /// it while the rule stays on the words. The room the spacer buys is not
    /// part of this — macOS TextKit 1 lays a bare `NSTextAttachment` out at a
    /// 1pt placeholder advance rather than the `bounds` UIKit honors — so what
    /// is asserted is which side each thing is anchored to.
    @Test func followsTheSpacerToTheRightOnARightToLeftRun() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let geometry = RichReferenceMarkGeometry(metrics: metrics)
        let pieces = fragments(
            rightToLeft(body([.text("שלום "), .reference(hebrew), .text(" תודה")], metrics: metrics)),
            width: 280,
            markSize: geometry.markSize
        )

        #expect(pieces.count == 1)
        guard let piece = pieces.first,
              let markLeadingX = piece.placement.markLeadingX,
              let spacerX = piece.spacerX
        else {
            Issue.record("the right-to-left run laid out without a mark")
            return
        }
        // The mark hangs off the spacer at the right of the run.
        #expect(abs(markLeadingX - spacerX) <= geometry.markSize)
        #expect(markLeadingX > piece.bounds.midX)
        // The rule stops at the label's leading glyph, short of the fragment's
        // own box: the space inside the label reports the width of the whole
        // reordered segment it sits in rather than of a space.
        #expect(abs(piece.placement.underlineToX - (piece.labelHead?.maxX ?? 0)) < 0.01)
        #expect(piece.placement.underlineToX < piece.bounds.maxX)
        // And it starts on the words at the fragment's left edge, not a
        // spacer's width in from it.
        #expect(abs(piece.placement.underlineFromX - piece.bounds.minX) < 0.01)
        #expect(piece.placement.underlineFromX < piece.bounds.minX + geometry.leadingSpacer)
        #expect(piece.placement.underlineToX > piece.placement.underlineFromX)
    }

    /// And the placement is read from the run's *characters*, never from the
    /// glyphs the fragment happens to hand over: under bidi the engine reorders
    /// the spacer and the neighbouring words in among the label's glyphs, so
    /// widening the fragment to the whole line must not move a dot.
    @Test func readsThePlacementFromTheRunsCharactersNotTheFragmentsGlyphs() {
        let metrics = RichReferenceMetricsFixture.sanFrancisco(pointSize: 17)
        let markSize = RichReferenceMarkGeometry(metrics: metrics).markSize
        let text = rightToLeft(body([.text("שלום "), .reference(hebrew), .text(" תודה")], metrics: metrics))
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
    /// derive both numbers from, and where the engine put the spacer and the
    /// label's first glyph.
    private struct Fragment {
        let placement: RichReferenceRunPiece
        let bounds: CGRect
        let spacerX: CGFloat?
        /// The label's first glyph: its rightmost, running right to left.
        let labelHead: CGRect?
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
                        spacerX: held.map { layoutManager.location(forGlyphAt: $0).x },
                        // The spacer is an attachment and a word joiner, so the
                        // label's first glyph is two past it.
                        labelHead: held.map {
                            layoutManager.boundingRect(
                                forGlyphRange: NSRange(location: $0 + 2, length: 1),
                                in: container
                            )
                        }
                    )
                )
            }
            return fragments
        }
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

    private static func reference(
        id: String,
        kind: MentionPresentationKind,
        label: String
    ) -> RichReferencePresentation {
        RichReferencePresentation(id: id, kind: kind, label: label, avatarURL: nil)
    }
}
